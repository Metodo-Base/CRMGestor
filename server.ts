/**
 * server.ts (ou server.tsx dependendo do seu setup)
 * ✅ Correções aplicadas:
 * 1) Conversas (WhatsApp/Messaging) agora somam corretamente:
 *    - onsite_conversion.messaging_conversation_started_7d
 *    - e qualquer variação que comece com: onsite_conversion.messaging_conversation_started
 * 2) Paginação do Meta NÃO perde params/fields/actions nas páginas seguintes
 * 3) Cache versionado (invalida cache antigo com cálculo errado)
 * 4) OAuth Meta inclui ads_management + auth_type=rerequest
 * 5) Não “mascara” erro do Meta como 0 (retorna details quando falha)
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios, { AxiosError } from "axios";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { GoogleGenAI, Type } from "@google/genai";
import { adminDb } from "./api/lib/firebase-admin.js";
import {
  format,
  subDays,
  addDays,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const META_API_VERSION = process.env.META_API_VERSION || "v19.0";
const PORT = Number(process.env.PORT) || 3000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/** =========================
 * Helpers (Meta actions)
 * ========================= */

type MetaAction = { action_type: string; value: string | number };

const toNumber = (v: any): number => {
  const n = parseFloat(String(v ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const normalizeActions = (input: any): MetaAction[] => {
  if (!input) return [];

  if (Array.isArray(input)) return input as MetaAction[];

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? (parsed as MetaAction[]) : [];
    } catch {
      return [];
    }
  }

  if (typeof input === "object") {
    // { data: [...] }
    if (Array.isArray((input as any).data)) return (input as any).data;

    // { action_type, value }
    if ((input as any).action_type && (input as any).value != null) {
      return [input as MetaAction];
    }

    // { "action_type": value, ... }
    return Object.entries(input).map(([k, v]) => ({ action_type: k, value: v }));
  }

  return [];
};

const sumActionsByPrefix = (actionsRaw: any, prefix: string): number => {
  const actions = normalizeActions(actionsRaw);
  let total = 0;
  for (const a of actions) {
    const t = String(a?.action_type || "");
    if (t.startsWith(prefix)) total += toNumber((a as any)?.value);
  }
  return total;
};

/**
 * ✅ ESSA é a correção principal do WA zerado:
 * seu Meta retorna "onsite_conversion.messaging_conversation_started_7d"
 * então somamos por prefixo: "onsite_conversion.messaging_conversation_started"
 */
const getMessagingConversationsStarted = (actionsRaw: any): number => {
  return sumActionsByPrefix(actionsRaw, "onsite_conversion.messaging_conversation_started");
};

const sumActionsByTypes = (actionsRaw: any, types: string[]): number => {
  const actions = normalizeActions(actionsRaw);
  const set = new Set(types.map((t) => t.toLowerCase()));
  let total = 0;

  for (const a of actions) {
    const t = String(a?.action_type || "").toLowerCase();
    if (set.has(t)) total += toNumber((a as any)?.value);
  }
  return total;
};

/** =========================
 * MetaAdsService (robusto)
 * ========================= */
class MetaAdsService {
  private static MAX_RETRIES = 3;
  private static INITIAL_BACKOFF = 2000; // ms
  private static CHUNK_SIZE_DAYS = 15;
  private static MAX_PAGES = 50;

  static async fetchWithRetry(url: string, config: any, retries = MetaAdsService.MAX_RETRIES): Promise<any> {
    try {
      return await axios.get(url, config);
    } catch (err: any) {
      const error = err as AxiosError;
      const status = error.response?.status;
      const data: any = error.response?.data;

      const isRetryable =
        status === 429 ||
        (status != null && status >= 500 && status <= 599) ||
        (error as any).code === "ECONNABORTED";

      // Meta rate limit codes
      if (data?.error?.code === 17 || data?.error?.code === 80004) {
        const backoff = 10_000;
        await new Promise((r) => setTimeout(r, backoff));
        // não decrementa retries aqui
        return this.fetchWithRetry(url, config, retries);
      }

      if (isRetryable && retries > 0) {
        const attempt = MetaAdsService.MAX_RETRIES - retries + 1;
        const backoff = MetaAdsService.INITIAL_BACKOFF * attempt;
        await new Promise((r) => setTimeout(r, backoff));
        return this.fetchWithRetry(url, config, retries - 1);
      }

      throw err;
    }
  }

  /**
   * ✅ Correção de paginação:
   * - Se paging.next já tem "?", geralmente já contém os query params (fields, breakdowns, etc).
   * - Se NÃO tem, reenviamos config.params.
   * - Isso evita "página 2+ sem actions".
   */
  static async fetchAllPages(url: string, config: any, maxPages = MetaAdsService.MAX_PAGES): Promise<any[]> {
    let all: any[] = [];
    let nextUrl: string | null = url;
    let page = 0;

    const baseConfig = { ...config };

    while (nextUrl && page < maxPages) {
      const hasQuery = nextUrl.includes("?");
      const requestConfig = hasQuery
        ? { headers: baseConfig.headers, timeout: baseConfig.timeout }
        : baseConfig;

      const resp = await this.fetchWithRetry(nextUrl, requestConfig);
      const data = resp.data?.data || [];
      all = all.concat(data);

      const next = resp.data?.paging?.next;
      if (next && data.length > 0) {
        nextUrl = next;
        page++;
      } else {
        nextUrl = null;
      }
    }

    return all;
  }

  static generateCacheKey(adAccountId: string, level: string, since: string, until: string, params: any): string {
    const CACHE_VERSION = "v3_fix_conversation_started_prefix";
    const cleanParams = { ...params };
    delete cleanParams.access_token;
    delete cleanParams.time_range;
    delete cleanParams.date_preset;

    const paramStr = JSON.stringify(cleanParams);
    return crypto
      .createHash("md5")
      .update(`${CACHE_VERSION}_${adAccountId}_${level}_${since}_${until}_${paramStr}`)
      .digest("hex");
  }

  static deduplicate(data: any[], level: string): any[] {
    const seen = new Set<string>();

    return data.filter((item) => {
      let key = "";
      if (level === "ad") key = `${item.ad_id}_${item.date_start}`;
      else if (level === "campaign") key = `${item.campaign_id}_${item.date_start}`;
      else key = `${item.account_id}_${item.date_start}`;

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  static async getInsightsInChunks(
    accessToken: string,
    adAccountId: string,
    level: "ad" | "campaign" | "account",
    since: string,
    until: string,
    baseParams: any,
    useCache = true
  ): Promise<{ data: any[]; debug: any[] }> {
    const startDate = parseISO(since);
    const endDate = parseISO(until);
    let cursor = startDate;

    const chunks: Array<{ since: string; until: string }> = [];
    while (isBefore(cursor, endDate) || format(cursor, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd")) {
      let chunkEnd = addDays(cursor, MetaAdsService.CHUNK_SIZE_DAYS - 1);
      if (!isBefore(chunkEnd, endDate)) chunkEnd = endDate;

      chunks.push({
        since: format(cursor, "yyyy-MM-dd"),
        until: format(chunkEnd, "yyyy-MM-dd"),
      });
      cursor = addDays(chunkEnd, 1);
    }

    const allResults: any[] = [];
    const debugChunks: any[] = [];

    for (const chunk of chunks) {
      const cacheKey = this.generateCacheKey(adAccountId, level, chunk.since, chunk.until, baseParams);

      // Cache read
      if (useCache && adminDb) {
        try {
          const doc = await adminDb.collection("meta_cache").doc(cacheKey).get();
          if (doc.exists) {
            const cached = doc.data();
            const today = format(new Date(), "yyyy-MM-dd");
            const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

            // Não usar cache se incluir hoje/ontem (dados ainda mudam)
            if (chunk.until !== today && chunk.until !== yesterday && cached?.status === "success" && Array.isArray(cached?.data)) {
              allResults.push(...cached.data);
              debugChunks.push({ ...chunk, status: "cache_hit", count: cached.data.length });
              continue;
            }
          }
        } catch (e: any) {
          debugChunks.push({ ...chunk, status: "cache_read_failed", error: e?.message || String(e) });
        }
      }

      // Live fetch
      try {
        const url = `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights`;
        const params = { ...baseParams, time_range: JSON.stringify(chunk) };

        const data = await this.fetchAllPages(url, {
          params,
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 60_000,
        });

        allResults.push(...data);
        debugChunks.push({ ...chunk, status: "success", count: data.length });

        if (useCache && adminDb) {
          await adminDb.collection("meta_cache").doc(cacheKey).set({
            ad_account_id: adAccountId,
            level,
            since: chunk.since,
            until: chunk.until,
            params: baseParams,
            data,
            status: "success",
            fetched_at: new Date().toISOString(),
            records_count: data.length,
          });
        }
      } catch (err: any) {
        const data = (err as any)?.response?.data;
        debugChunks.push({
          ...chunk,
          status: "failed",
          error: (err as any)?.message || String(err),
          meta_error: data?.error ? data.error : undefined,
        });

        // Fallback cache on failure (se existir)
        if (useCache && adminDb) {
          try {
            const doc = await adminDb.collection("meta_cache").doc(cacheKey).get();
            if (doc.exists) {
              const cached = doc.data();
              if (cached?.status === "success" && Array.isArray(cached?.data)) {
                allResults.push(...cached.data);
                debugChunks.push({ ...chunk, status: "fallback_cache", count: cached.data.length });
                continue;
              }
            }
          } catch {
            // ignore
          }
        }
      }
    }

    const final = this.deduplicate(allResults, level);
    return { data: final, debug: debugChunks };
  }
}

/** =========================
 * Server
 * ========================= */
async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  /** API Key middleware */
  const apiKeyAuth = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing API Key" });
    }
    const apiKey = authHeader.split(" ")[1];

    try {
      const snap = await adminDb
        .collection("api_keys")
        .where("key_hash", "==", apiKey)
        .where("status", "==", "ativa")
        .limit(1)
        .get();

      if (snap.empty) return res.status(401).json({ error: "Unauthorized: Invalid or Revoked API Key" });
      next();
    } catch (e) {
      return res.status(500).json({ error: "Erro interno na autenticação" });
    }
  };

  /** =========================
   * OAuth Meta
   * ========================= */

  async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
    try {
      const resp = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`, {
        params: {
          grant_type: "fb_exchange_token",
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          fb_exchange_token: shortLivedToken,
        },
        timeout: 30_000,
      });
      return resp.data.access_token || shortLivedToken;
    } catch {
      return shortLivedToken;
    }
  }

  app.get("/api/auth/meta/url", (req, res) => {
    const { cliente_id, origin } = req.query;

    const appId = process.env.META_APP_ID;
    if (!appId) return res.status(500).json({ error: "META_APP_ID ausente" });

    const baseUrl = (origin as string) || process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const redirectUri =
      process.env.META_REDIRECT_URI || `${String(baseUrl).replace(/\/
$
/, "")}/api/auth/facebook/callback`;

    // ✅ incluiu ads_management e rerequest
    const scopes = ["ads_read", "ads_management", "business_management"].join(",");
    const state = cliente_id ? String(cliente_id) : "";

    const url =
      `https://www.facebook.com/${META_API_VERSION}/dialog/oauth` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code` +
      `&auth_type=rerequest` +
      `&state=${encodeURIComponent(state)}`;

    res.json({ url });
  });

  app.get("/api/auth/facebook/callback", async (req, res) => {
    const { code, state: clienteId } = req.query;

    if (!code) return res.status(400).send("Código de autorização ausente.");

    try {
      const redirectUri =
        process.env.META_REDIRECT_URI ||
        `${(process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/
$
/, "")}/api/auth/facebook/callback`;

      // code -> short token
      const tokenResp = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`, {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          redirect_uri: redirectUri,
          code,
        },
        timeout: 30_000,
      });

      let accessToken = tokenResp.data.access_token as string;
      accessToken = await exchangeForLongLivedToken(accessToken);

      if (clienteId && clienteId !== "undefined") {
        await adminDb
          .collection("clientes")
          .doc(String(clienteId))
          .set(
            {
              meta_ads_access_token: accessToken,
              meta_ads_conectado: true,
              updated_at: new Date().toISOString(),
            },
            { merge: true }
          );
      }

      // Fetch ad accounts (para seleção)
      const adAccountsResp = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/me/adaccounts`, {
        params: { fields: "name,account_id,currency,timezone_name" },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 30_000,
      });

      const adAccounts = adAccountsResp.data.data || [];

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'OAUTH_AUTH_SUCCESS',
                  platform: 'meta',
                  accessToken: '${accessToken}',
                  adAccounts: ${JSON.stringify(adAccounts)},
                }, '*');
                setTimeout(() => window.close(), 600);
              } else {
                window.location.href = '/admin/dashboard';
              }
            </script>
            <p>Autenticação Meta Ads concluída.</p>
          </body>
        </html>
      `);
    } catch (err: any) {
      const details = err?.response?.data || err?.message || String(err);
      res.status(500).send(`Erro na autenticação com Meta Ads: ${JSON.stringify(details)}`);
    }
  });

  /** =========================
   * Meta Insights (principal)
   * ========================= */
  app.get("/api/meta/insights", async (req, res) => {
    const {
      access_token,
      ad_account_id,
      date_preset,
      since,
      until,
      debug,
      nocache,
    } = req.query as Record<string, any>;

    const isDebug = debug === "1" || debug === "true";
    const useCache = !(nocache === "1" || nocache === "true");

    if (!access_token || !ad_account_id) {
      return res.status(400).json({ error: "Parâmetros 'access_token' e 'ad_account_id' são obrigatórios." });
    }

    try {
      const accountId = String(ad_account_id).startsWith("act_") ? String(ad_account_id) : `act_${ad_account_id}`;

      // Período
      let finalSince = String(since || "");
      let finalUntil = String(until || "");
      const preset = String(date_preset || "last_30d");

      if (!finalSince || !finalUntil) {
        const today = new Date();
        finalUntil = format(today, "yyyy-MM-dd");

        if (preset === "maximum") finalSince = process.env.META_BACKFILL_START_DATE || "2023-01-01";
        else if (preset === "last_90d") finalSince = format(subDays(today, 90), "yyyy-MM-dd");
        else if (preset === "this_month") {
          finalSince = format(startOfDay(new Date(today.getFullYear(), today.getMonth(), 1)), "yyyy-MM-dd");
        } else {
          finalSince = format(subDays(today, 30), "yyyy-MM-dd");
        }
      }

      // Params base
      const baseAdDailyParams = {
        fields:
          "campaign_name,adset_name,ad_name,campaign_id,adset_id,ad_id,impressions,clicks,spend,reach,frequency,actions,cpm,ctr,cpc,date_start,date_stop",
        level: "ad",
        time_increment: 1,
        action_breakdowns: "action_type",
        limit: 1000,
      };

      const baseCampaignDailyParams = {
        fields: "campaign_id,campaign_name,impressions,clicks,spend,reach,frequency,actions,objective,optimization_goal,date_start,date_stop",
        level: "campaign",
        time_increment: 1,
        action_breakdowns: "action_type",
        limit: 1000,
      };

      // Chunks (diário)
      const [adDailyRes, campaignDailyRes] = await Promise.all([
        MetaAdsService.getInsightsInChunks(access_token, accountId, "ad", finalSince, finalUntil, baseAdDailyParams, useCache),
        MetaAdsService.getInsightsInChunks(access_token, accountId, "campaign", finalSince, finalUntil, baseCampaignDailyParams, useCache),
      ]);

      const rawAdDaily = adDailyRes.data;
      const rawCampaignDaily = campaignDailyRes.data;

      // Summary (conta)
      const summaryParams: any = {
        fields: "reach,frequency,impressions,clicks,spend,actions",
        level: "account",
        action_breakdowns: "action_type",
        time_range: JSON.stringify({ since: finalSince, until: finalUntil }),
      };

      let summaryData: any = {};
      try {
        const summaryResp = await MetaAdsService.fetchWithRetry(`https://graph.facebook.com/${META_API_VERSION}/${accountId}/insights`, {
          headers: { Authorization: `Bearer ${access_token}` },
          params: summaryParams,
          timeout: 45_000,
        });
        summaryData = summaryResp.data?.data?.[0] || {};
      } catch (e: any) {
        // não “zera silencioso” aqui
        summaryData = {};
      }

      // Leads (se você já usa isso)
      const leadActionTypes = [
        "lead",
        "onsite_conversion.lead",
        "complete_registration",
        "onsite_conversion.complete_registration",
        "offsite_conversion.fb_pixel_complete_registration",
      ];

      // Format data
      const formattedData = rawAdDaily.map((item: any) => {
        const wa = getMessagingConversationsStarted(item.actions);
        const leads = sumActionsByTypes(item.actions, leadActionTypes);

        return {
          ...item,
          spend: toNumber(item.spend),
          impressions: parseInt(item.impressions || "0", 10) || 0,
          clicks: parseInt(item.clicks || "0", 10) || 0,
          reach: parseInt(item.reach || "0", 10) || 0,
          frequency: toNumber(item.frequency),
          cpm: toNumber(item.cpm),
          ctr: toNumber(item.ctr),
          cpc: toNumber(item.cpc),
          leads,
          whatsapp_conversations: wa, // mantive o nome do campo do seu dashboard
        };
      });

      // Totais WA: preferir summary se vier, senão somar campanhas
      const waFromSummary = getMessagingConversationsStarted(summaryData.actions || []);
      const waFromCampaignSum = rawCampaignDaily.reduce((acc: number, it: any) => acc + getMessagingConversationsStarted(it.actions), 0);
      const totalWa = waFromSummary > 0 ? waFromSummary : waFromCampaignSum;

      const leadsFromSummary = sumActionsByTypes(summaryData.actions || [], leadActionTypes);
      const leadsFromCampaignSum = rawCampaignDaily.reduce((acc: number, it: any) => acc + sumActionsByTypes(it.actions, leadActionTypes), 0);
      const totalLeads = leadsFromSummary > 0 ? leadsFromSummary : leadsFromCampaignSum;

      // Campaigns (agregado simples)
      const campaignMap = new Map<string, any>();
      for (const row of rawCampaignDaily) {
        const id = String(row.campaign_id || "");
        if (!id) continue;

        if (!campaignMap.has(id)) {
          campaignMap.set(id, {
            campanha_id_externo: id,
            campanha_nome: row.campaign_name,
            investimento: 0,
            cliques: 0,
            impressoes: 0,
            reach: 0,
            frequency: 0,
            leads: 0,
            whatsapp_conversations: 0,
            plataforma: "meta",
          });
        }

        const c = campaignMap.get(id);
        c.investimento += toNumber(row.spend);
        c.cliques += parseInt(row.clicks || "0", 10) || 0;
        c.impressoes += parseInt(row.impressions || "0", 10) || 0;
        c.reach += parseInt(row.reach || "0", 10) || 0;
        c.frequency += toNumber(row.frequency);
        c.leads += sumActionsByTypes(row.actions, leadActionTypes);
        c.whatsapp_conversations += getMessagingConversationsStarted(row.actions);
      }

      const debugInfo = isDebug
        ? {
            accountId,
            period: { since: finalSince, until: finalUntil },
            cache_used: useCache,
            sample_action_types: normalizeActions(rawCampaignDaily?.[0]?.actions)
              .map((a) => String(a.action_type || ""))
              .filter(Boolean)
              .slice(0, 30),
            sample_whatsapp_conversations: getMessagingConversationsStarted(rawCampaignDaily?.[0]?.actions),
            chunks: {
              ad: adDailyRes.debug,
              campaign: campaignDailyRes.debug,
            },
          }
        : null;

      return res.json({
        summary: {
          reach: parseInt(summaryData.reach || "0", 10) || 0,
          frequency: toNumber(summaryData.frequency),
          impressions: parseInt(summaryData.impressions || "0", 10) || 0,
          clicks: parseInt(summaryData.clicks || "0", 10) || 0,
          spend: toNumber(summaryData.spend),
          leads: totalLeads,
          whatsapp_conversations: totalWa,
        },
        data: formattedData,
        campaigns: Array.from(campaignMap.values()),
        debug: debugInfo,
      });
    } catch (err: any) {
      const details = err?.response?.data || err?.message || String(err);
      return res.status(502).json({
        error: "Erro ao buscar dados do Meta Ads",
        details,
      });
    }
  });

  /** =========================
   * Google (mantido)
   * ========================= */

  app.get("/api/auth/google/url", (req, res) => {
    try {
      const { cliente_id, origin } = req.query;

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) return res.status(500).json({ error: "Google OAuth não configurado" });

      let redirectUri = process.env.GOOGLE_REDIRECT_URI;
      if (!redirectUri) {
        const baseUrl = (origin as string) || process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
        const clean = String(baseUrl).replace(/\/
$
/, "");
        redirectUri = `${clean}/api/auth/google/callback`;
      }

      const client = new OAuth2Client(clientId, clientSecret, redirectUri);

      const url = client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/adwords"],
        prompt: "consent",
        state: String(cliente_id || ""),
      });

      res.json({ url });
    } catch (e: any) {
      res.status(500).json({ error: "Erro ao gerar URL Google OAuth", details: e?.message || String(e) });
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, state } = req.query;
    const clienteId = String(state || "");

    try {
      if (!code) throw new Error("Código de autorização ausente");

      const clientId = process.env.GOOGLE_CLIENT_ID!;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
      let redirectUri = process.env.GOOGLE_REDIRECT_URI;

      if (!redirectUri) {
        const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/
$
/, "");
        redirectUri = `${baseUrl}/api/auth/google/callback`;
      }

      const client = new OAuth2Client(clientId, clientSecret, redirectUri);
      const { tokens } = await client.getToken(String(code));
      const refreshToken = tokens.refresh_token;

      if (clienteId && clienteId !== "undefined" && refreshToken) {
        await adminDb
          .collection("clientes")
          .doc(clienteId)
          .set(
            {
              google_ads_refresh_token: refreshToken,
              google_ads_conectado: true,
              updated_at: new Date().toISOString(),
            },
            { merge: true }
          );
      }

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type:'OAUTH_AUTH_SUCCESS', platform:'google' }, '*');
                setTimeout(() => window.close(), 600);
              } else {
                window.location.href = '/admin/dashboard';
              }
            </script>
            <p>Conexão Google concluída.</p>
          </body>
        </html>
      `);
    } catch (e: any) {
      res.status(500).send(`Erro Google OAuth: ${e?.message || String(e)}`);
    }
  });

  /** =========================
   * API V1 (mantida)
   * ========================= */
  app.get("/api/v1/clientes", apiKeyAuth, async (req, res) => {
    try {
      const snap = await adminDb.collection("clientes").get();
      const items = snap.docs.map((doc) => {
        const data = doc.data();
        // remove tokens do retorno
        const { meta_ads_access_token, google_ads_refresh_token, ...safe } = data as any;
        return { id: doc.id, ...safe };
      });
      res.json({ meta: { total: items.length }, items });
    } catch {
      res.status(500).json({ error: "Erro ao listar clientes" });
    }
  });

  app.get("/api/v1/clientes/:id/campanhas", apiKeyAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const snap = await adminDb.collection("dados_campanhas").where("cliente_id", "==", id).get();
      const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json({ meta: { total: items.length }, items });
    } catch {
      res.status(500).json({ error: "Erro ao listar campanhas" });
    }
  });

  app.post("/api/v1/busca-ia", apiKeyAuth, async (req, res) => {
    const { query: userQuery, cliente_id, modo = "enxuto" } = req.body || {};
    if (!userQuery) return res.status(400).json({ error: "Query é obrigatória" });

    try {
      const interpretationResponse = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `Interprete a seguinte busca: "${userQuery}". Extraia filtros (plataforma, metrica, periodo, status). Responda APENAS em JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              plataforma: { type: Type.STRING },
              metrica: { type: Type.STRING },
              periodo: { type: Type.STRING },
              status: { type: Type.STRING },
              intencao: { type: Type.STRING },
            },
          },
        },
      });

      const filtros = JSON.parse(interpretationResponse.text || "{}");

      let q: any = adminDb.collection("dados_campanhas");
      if (cliente_id) q = q.where("cliente_id", "==", cliente_id);
      if (filtros.plataforma) q = q.where("plataforma", "==", filtros.plataforma);

      const snap = await q.limit(20).get();
      const dados = snap.docs.map((d: any) => d.data());

      const finalResponse = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `Dados: ${JSON.stringify(dados)}. Responda: "${userQuery}". Modo: ${modo}.`,
      });

      res.json({
        meta: { filtros_interpretados: filtros, timestamp: new Date().toISOString() },
        resposta_ia: finalResponse.text || "",
        dados_relevantes: dados,
      });
    } catch (e: any) {
      res.status(500).json({ error: "Erro interno ao processar busca com IA", details: e?.message || String(e) });
    }
  });

  /** =========================
   * Vite middleware
   * ========================= */
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
