import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { access_token, ad_account_id, date_preset, since, until } = req.query;

  if (!access_token || !ad_account_id) {
    return res.status(400).json({ 
      error: "Parâmetros 'access_token' e 'ad_account_id' são obrigatórios." 
    });
  }

  try {
    const accountId = (ad_account_id as string).startsWith('act_') ? ad_account_id : `act_${ad_account_id}`;
    
    // Configurar parâmetros de data
    const timeRange = (since && until) ? JSON.stringify({ since, until }) : null;
    const datePreset = (date_preset as string) || 'last_30d';

    // Chamada 1: Resumo da Conta (para Alcance e Frequência precisos)
    const summaryParams: any = {
      fields: 'reach,frequency,impressions,clicks,spend,actions',
      level: 'account',
    };
    if (timeRange) summaryParams.time_range = timeRange;
    else summaryParams.date_preset = datePreset;

    // Chamada 2: Detalhado por Anúncio e Dia (para Gráficos e Rankings)
    const detailedParams: any = {
      fields: 'campaign_name,adset_name,ad_name,campaign_id,adset_id,ad_id,impressions,clicks,spend,reach,frequency,actions,cost_per_action_type,cpm,cpp,ctr,cpc',
      level: 'ad',
      time_increment: 1,
      limit: 1000 // Reduzido de 5000 para evitar timeouts
    };
    if (timeRange) detailedParams.time_range = timeRange;
    else detailedParams.date_preset = datePreset;

    // Se for "maximum", a Meta API não permite time_increment: 1 se o período for > 37 meses.
    // Vamos tentar com time_increment: 1 primeiro, e se falhar, tentamos sem o incremento diário.
    if (datePreset === 'maximum') {
      console.log("[MetaAds] Detectado preset 'maximum'. Tentando busca resiliente.");
    }

    console.log(`[MetaAds] Buscando dados para ${accountId} com preset ${datePreset} e time_range ${timeRange}`);

    let summaryData: any = {};
    let rawDetailedData: any[] = [];

    try {
      const summaryRes = await axios.get(`https://graph.facebook.com/v19.0/${accountId}/insights`, {
        headers: { Authorization: `Bearer ${access_token}` },
        params: summaryParams
      });
      summaryData = summaryRes.data.data?.[0] || {};
    } catch (summaryError: any) {
      console.warn(`[MetaAds] Falha ao buscar resumo da conta:`, summaryError?.response?.data || summaryError.message);
    }

    const fetchDetailedData = async (params: any) => {
      let results: any[] = [];
      let nextUrl = `https://graph.facebook.com/v19.0/${accountId}/insights`;
      let hasNextPage = true;
      let pageCount = 0;
      const maxPages = 20; // Aumentado para compensar o limite menor por página

      while (hasNextPage && pageCount < maxPages) {
        const config: any = {
          headers: { 
            'Authorization': `Bearer ${access_token}`,
            'Accept': 'application/json'
          },
          timeout: 45000 // Aumentado para 45s
        };
        
        if (pageCount === 0) {
          config.params = params;
        }

        const detailedRes = await axios.get(nextUrl, config);
        const pageData = detailedRes.data.data || [];
        results = [...results, ...pageData];
        
        if (detailedRes.data.paging?.next && pageData.length > 0) {
          nextUrl = detailedRes.data.paging.next;
          pageCount++;
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
      
      // Se o erro for relacionado ao limite de 37 meses ou timeout, tenta sem o incremento diário
      if (errorMessage.includes("37 months") || datePreset === 'maximum' || detailedError.code === 'ECONNABORTED') {
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

    // Tipos de ações de conversão (leads)
    const leadActionTypes = [
      'lead', 
      'onsite_conversion.messaging_conversation_started_7d', 
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

    // Formatar o JSON de retorno
    const formattedData = rawDetailedData.map((item: any) => {
      const leads = item.actions?.reduce((acc: number, a: any) => {
        if (leadActionTypes.includes(a.action_type)) {
          const val = parseFloat(a.value || 0);
          return acc + (isNaN(val) ? 0 : val);
        }
        return acc;
      }, 0) || 0;

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

    const totalSpend = parseFloat(summaryData.spend || 0);
    const safeTotalSpend = isNaN(totalSpend) ? 0 : totalSpend;

    res.status(200).json({
      summary: {
        period: datePreset || `${since} to ${until}`,
        reach: parseInt(summaryData.reach || 0),
        frequency: parseFloat(summaryData.frequency || 0),
        impressions: parseInt(summaryData.impressions || 0),
        clicks: parseInt(summaryData.clicks || 0),
        spend: safeTotalSpend.toFixed(2),
        leads: totalLeads,
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
