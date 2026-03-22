import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { access_token, ad_account_id, date_preset, since, until } = req.query;

  if (!access_token || !ad_account_id || ad_account_id === 'undefined') {
    return res.status(400).json({ error: "Parâmetros 'access_token' e 'ad_account_id' são obrigatórios e devem ser válidos." });
  }

  try {
    const accountId = (ad_account_id as string).startsWith('act_') ? ad_account_id : `act_${ad_account_id}`;
    const timeRange = (since && until) ? JSON.stringify({ since, until }) : null;
    const datePreset = (date_preset as string) || 'last_30d';

    const summaryParams: any = { fields: 'reach,frequency,impressions,clicks,spend,actions', level: 'account' };
    if (timeRange) summaryParams.time_range = timeRange; else summaryParams.date_preset = datePreset;

    const detailedParams: any = {
      fields: 'campaign_name,adset_name,ad_name,campaign_id,adset_id,ad_id,impressions,clicks,spend,reach,frequency,actions,cost_per_action_type,cpm,cpp,ctr,cpc',
      level: 'ad', time_increment: 1, limit: 1000
    };
    if (timeRange) detailedParams.time_range = timeRange; else detailedParams.date_preset = datePreset;

    let summaryData: any = {};
    let rawDetailedData: any[] = [];

    // PROTEÇÃO RESTAURADA AQUI
    try {
      const summaryRes = await axios.get(`https://graph.facebook.com/v19.0/${accountId}/insights`, {
        headers: { Authorization: `Bearer ${access_token}` }, params: summaryParams
      });
      summaryData = summaryRes.data.data?.[0] || {};
    } catch (summaryError: any) {
      console.warn(`[MetaAds] Aviso: Falha ao buscar summary para ${accountId}. Continuando com dados detalhados.`, summaryError?.response?.data?.error?.message || summaryError.message);
    }

    let nextUrl = `https://graph.facebook.com/v19.0/${accountId}/insights`;
    let currentParams = { ...detailedParams };
    let pageCount = 0;

    while (nextUrl && pageCount < 10) {
      const detailedRes = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${access_token}` }, params: currentParams
      });
      rawDetailedData = [...rawDetailedData, ...(detailedRes.data.data || [])];
      if (detailedRes.data.paging?.next) {
        nextUrl = detailedRes.data.paging.next;
        currentParams = {}; 
        pageCount++;
      } else {
        nextUrl = '';
      }
    }

    const leadActionTypes = [
      'lead', 
      'contact', 
      'submit_form', 
      'complete_registration', 
      'offsite_conversion.fb_pixel_lead',
      'offsite_conversion.fb_pixel_complete_registration', 
      'app_custom_event.fb_mobile_complete_registration'
    ];

    const getWaConversations = (actions: any[]): number => {
      if (!actions || !Array.isArray(actions)) return 0;
      return actions.reduce((acc: number, a: any) => {
        if (String(a.action_type || "").startsWith("onsite_conversion.messaging_conversation_started")) {
          const val = parseFloat(a.value || 0);
          return acc + (isNaN(val) ? 0 : val);
        }
        return acc;
      }, 0);
    };

    const formattedData = rawDetailedData.map((item: any) => {
      const leads = item.actions?.reduce((acc: number, a: any) => {
        if (leadActionTypes.includes(a.action_type)) {
          const val = parseFloat(a.value || 0);
          return acc + (isNaN(val) ? 0 : val);
        }
        return acc;
      }, 0) || 0;

      const wa_conversations = getWaConversations(item.actions);
      const spend = parseFloat(item.spend || 0);
      const safeSpend = isNaN(spend) ? 0 : spend;

      return {
        date_start: item.date_start, campaign_id: item.campaign_id, campaign_name: item.campaign_name,
        adset_id: item.adset_id, adset_name: item.adset_name, ad_id: item.ad_id, ad_name: item.ad_name,
        impressions: parseInt(item.impressions || 0), clicks: parseInt(item.clicks || 0),
        reach: parseInt(item.reach || 0), frequency: parseFloat(item.frequency || 0),
        spend: safeSpend.toFixed(2), leads: leads, wa_conversations: wa_conversations,
        cost_per_lead: leads > 0 ? (safeSpend / leads).toFixed(2) : "0.00",
        cpm: parseFloat(item.cpm || 0), ctr: parseFloat(item.ctr || 0), cpc: parseFloat(item.cpc || 0)
      };
    });

    const totalLeads = summaryData.actions?.reduce((acc: number, a: any) => {
      if (leadActionTypes.includes(a.action_type)) {
        const val = parseFloat(a.value || 0);
        return acc + (isNaN(val) ? 0 : val);
      }
      return acc;
    }, 0) || 0;

    const totalWaConversations = getWaConversations(summaryData.actions);
    const totalSpend = parseFloat(summaryData.spend || 0);
    const safeTotalSpend = isNaN(totalSpend) ? 0 : totalSpend;

    // Agregação para Rankings (Campanhas e Anúncios) - Necessário para o Dashboard
    const campaignMap = new Map();
    const adMap = new Map();

    formattedData.forEach(item => {
      if (!campaignMap.has(item.campaign_id)) {
        campaignMap.set(item.campaign_id, {
          campanha_id_externo: item.campaign_id, campanha_nome: item.campaign_name,
          investimento: 0, cliques: 0, conversoes: 0, impressoes: 0, wa_conversations: 0, plataforma: 'meta'
        });
      }
      const c = campaignMap.get(item.campaign_id);
      c.investimento += parseFloat(item.spend);
      c.cliques += item.clicks;
      c.conversoes += item.leads;
      c.impressoes += item.impressions;
      c.wa_conversations += item.wa_conversations;

      if (!adMap.has(item.ad_id)) {
        adMap.set(item.ad_id, {
          ad_id: item.ad_id, ad_name: item.ad_name, campaign_name: item.campaign_name,
          investimento: 0, cliques: 0, conversoes: 0, impressoes: 0, wa_conversations: 0, reach: 0
        });
      }
      const a = adMap.get(item.ad_id);
      a.investimento += parseFloat(item.spend);
      a.cliques += item.clicks;
      a.conversoes += item.leads;
      a.impressoes += item.impressions;
      a.wa_conversations += item.wa_conversations;
      a.reach += item.reach;
    });

    res.status(200).json({
      summary: {
        period: datePreset || `${since} to ${until}`, reach: parseInt(summaryData.reach || 0),
        frequency: parseFloat(summaryData.frequency || 0), impressions: parseInt(summaryData.impressions || 0),
        clicks: parseInt(summaryData.clicks || 0), spend: safeTotalSpend.toFixed(2),
        leads: totalLeads, wa_conversations: totalWaConversations, count: formattedData.length
      },
      data: formattedData,
      campaigns: Array.from(campaignMap.values()),
      ad_totals: Array.from(adMap.values())
    });
  } catch (error: any) {
    console.error("Erro no endpoint de insights:", error?.response?.data || error.message);
    res.status(500).json({ error: "Erro interno", details: error?.response?.data || error.message });
  }
}
