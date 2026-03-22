import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { ad_account_id, access_token, since, until, date_preset } = req.query;

  if (!ad_account_id || !access_token) {
    return res.status(400).json({ error: "Parâmetros 'ad_account_id' e 'access_token' são obrigatórios." });
  }

  try {
    const baseUrl = `https://graph.facebook.com/v19.0/${ad_account_id}/insights`;

    // 1. Buscar Resumo Total (Summary)
    const summaryParams: any = {
      access_token,
      fields: 'reach,frequency,impressions,clicks,spend,actions',
      level: 'account'
    };

    if (date_preset) {
      summaryParams.date_preset = date_preset;
    } else if (since && until) {
      summaryParams.time_range = JSON.stringify({ since, until });
    } else {
      summaryParams.date_preset = 'last_30d';
    }

    const summaryResponse = await axios.get(baseUrl, { params: summaryParams });
    const summaryData = summaryResponse.data.data[0] || {};

    // 2. Buscar Dados Detalhados (Por dia e campanha)
    const detailedParams: any = {
      access_token,
      fields: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,clicks,reach,frequency,spend,actions,cpm,ctr,cpc',
      level: 'ad',
      time_increment: 1,
      limit: 100
    };

    if (date_preset) {
      detailedParams.date_preset = date_preset;
    } else if (since && until) {
      detailedParams.time_range = JSON.stringify({ since, until });
    } else {
      detailedParams.date_preset = 'last_30d';
    }

    let rawDetailedData: any[] = [];

    const fetchDetailedData = async (params: any) => {
      let results: any[] = [];
      let currentUrl = baseUrl;
      let currentParams = { ...params };
      let hasNextPage = true;

      while (hasNextPage) {
        const response = await axios.get(currentUrl, { params: currentParams });
        results = results.concat(response.data.data || []);

        if (response.data.paging && response.data.paging.next) {
          currentUrl = response.data.paging.next;
          currentParams = {}; 
        } else {
          hasNextPage = false;
        }
      }
      return results;
    };

    try {
      rawDetailedData = await fetchDetailedData(detailedParams);
    } catch (detailedError: any) {
      const errorData = detailedError?.response?.data || detailedError.message;
      const errorMessage = errorData?.error?.message || "";

      if (errorMessage.includes("37 months") || date_preset === 'maximum' || detailedError.code === 'ECONNABORTED') {
        console.warn(`[MetaAds] Falha na busca detalhada com time_increment: 1. Tentando com 'all_days'. Erro:`, errorMessage);
        try {
          const fallbackParams = { ...detailedParams, time_increment: 'all_days' };
          rawDetailedData = await fetchDetailedData(fallbackParams);
        } catch (fallbackError: any) {
          const fallbackErrorData = fallbackError?.response?.data || fallbackError.message;
          console.error(`[MetaAds] Falha total na busca detalhada:`, JSON.stringify(fallbackErrorData));
          return res.status(500).json({ 
            error: "Erro ao buscar dados detalhados da Meta Ads API (Fallback falhou)", 
            details: fallbackErrorData 
          });
        }
      } else {
        console.error(`[MetaAds] Erro na busca detalhada:`, JSON.stringify(errorData));
        return res.status(500).json({ 
          error: "Erro ao buscar dados detalhados da Meta Ads API", 
          details: errorData 
        });
      }
    }

    // --- CORREÇÃO: SEPARANDO LEADS DE WHATSAPP ---

    // 1. Tipos de ações de conversão (leads normais) - REMOVIDO O WHATSAPP DAQUI
    const leadActionTypes = [
      'lead', 
      'contact', 
      'submit_form', 
      'complete_registration', 
      'onsite_conversion.post_save',
      'onsite_conversion.messaging_welcome_message_view',
      'offsite_conversion.fb_pixel_lead',
      'offsite_conversion.fb_pixel_complete_registration',
      'onsite_conversion.messaging_first_reply',
      'app_custom_event.fb_mobile_complete_registration'
    ];

    // 2. Função auxiliar para somar WhatsApp (pega qualquer variação, incluindo _7d)
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

    // Formatar o JSON de retorno
    const formattedData = rawDetailedData.map((item: any) => {
      // Calcula Leads Normais
      const leads = item.actions?.reduce((acc: number, a: any) => {
        if (leadActionTypes.includes(a.action_type)) {
          const val = parseFloat(a.value || 0);
          return acc + (isNaN(val) ? 0 : val);
        }
        return acc;
      }, 0) || 0;

      // Calcula WhatsApp
      const wa_conversations = getWaConversations(item.actions);

      const spend = parseFloat(item.spend || 0);
      const safeSpend = isNaN(spend) ? 0 : spend;

      return {
        date_start: item.date_start,
        campaign_id: item.campaign_id,
        campaign_name: item.campaign_name,
        adset_id: item.adset_id,
        adset_name: item.adset_name,
        ad_id: item.ad_id,
        ad_name: item.ad_name,
        impressions: parseInt(item.impressions || 0),
        clicks: parseInt(item.clicks || 0),
        reach: parseInt(item.reach || 0),
        frequency: parseFloat(item.frequency || 0),
        spend: safeSpend.toFixed(2),
        leads: leads,
        wa_conversations: wa_conversations, // Adicionado aqui!
        cost_per_lead: leads > 0 ? (safeSpend / leads).toFixed(2) : "0.00",
        cpm: parseFloat(item.cpm || 0),
        ctr: parseFloat(item.ctr || 0),
        cpc: parseFloat(item.cpc || 0)
      };
    });

    // Calcular resumo total preciso
    const totalLeads = summaryData.actions?.reduce((acc: number, a: any) => {
      if (leadActionTypes.includes(a.action_type)) {
        const val = parseFloat(a.value || 0);
        return acc + (isNaN(val) ? 0 : val);
      }
      return acc;
    }, 0) || 0;

    const totalWaConversations = getWaConversations(summaryData.actions); // Adicionado aqui!

    const totalSpend = parseFloat(summaryData.spend || 0);
    const safeTotalSpend = isNaN(totalSpend) ? 0 : totalSpend;

    res.status(200).json({
      summary: {
        period: date_preset || `${since} to ${until}`,
        reach: parseInt(summaryData.reach || 0),
        frequency: parseFloat(summaryData.frequency || 0),
        impressions: parseInt(summaryData.impressions || 0),
        clicks: parseInt(summaryData.clicks || 0),
        spend: safeTotalSpend.toFixed(2),
        leads: totalLeads,
        wa_conversations: totalWaConversations, // Adicionado aqui!
        count: formattedData.length
      },
      data: formattedData
    });
  } catch (error: any) {
    const errorData = error?.response?.data || error.message;
    console.error("Erro crítico no endpoint de insights:", JSON.stringify(errorData));
    res.status(500).json({ 
      error: "Erro interno ao processar dados da Meta Ads", 
      details: errorData 
    });
  }
}
