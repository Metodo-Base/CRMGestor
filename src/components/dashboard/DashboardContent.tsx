import { useEffect, useState, useMemo } from "react";
import { doc, getDoc, collection, query, where, getDocs, orderBy, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { Cliente, DadosCampanha, MetaAdsAccount } from "../../types";
import { 
  TrendingUp, MousePointer2, Eye, DollarSign, 
  Target, BarChart3, Facebook, Globe, Instagram,
  ChevronDown, Filter, Search, Calendar,
  Download, ArrowUpDown, Users, Activity,
  Zap, Award, ArrowUpRight, ArrowDownRight,
  Layers, PieChart as PieChartIcon, X, Bug, ListFilter, CheckCircle2
} from "lucide-react";
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from "recharts";
import { cn } from "../../lib/utils";
import { useTheme } from "../../context/ThemeContext";
import { format, subDays, isWithinInterval, parseISO, startOfDay, endOfDay, eachDayOfInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardContentProps {
  clienteId: string;
  isInternal?: boolean;
}

export default function DashboardContent({ clienteId, isInternal = false }: DashboardContentProps) {
  const { theme } = useTheme();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [dados, setDados] = useState<DadosCampanha[]>([]);
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [adTotals, setAdTotals] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Applied Filters (These trigger data fetching)
  const [periodo, setPeriodo] = useState("30"); // days
  const [filtroCampanha, setFiltroCampanha] = useState("");
  const [filtroPlataforma, setFiltroPlataforma] = useState("todas");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // Local Filters (These are changed by UI but don't trigger fetch until "Update" is clicked)
  const [localPeriodo, setLocalPeriodo] = useState(periodo);
  const [localFiltroCampanha, setLocalFiltroCampanha] = useState(filtroCampanha);
  const [localFiltroPlataforma, setLocalFiltroPlataforma] = useState(filtroPlataforma);
  const [localDataInicio, setLocalDataInicio] = useState(dataInicio);
  const [localDataFim, setLocalDataFim] = useState(dataFim);

  const [showComparison, setShowComparison] = useState(false);
  const [nivelVisao, setNivelVisao] = useState<"campanha" | "adset" | "anuncio">("campanha");
  const [activeChart, setActiveChart] = useState<"performance" | "engagement">("performance");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "investimento",
    direction: "desc",
  });

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [modalType, setModalType] = useState<"campaign" | "ad" | "all_campaigns" | null>(null);

  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const handleApplyFilters = () => {
    setPeriodo(localPeriodo);
    setFiltroCampanha(localFiltroCampanha);
    setFiltroPlataforma(localFiltroPlataforma);
    setDataInicio(localDataInicio);
    setDataFim(localDataFim);
  };

  const debugPanel = useMemo(() => {
    if (!debugMode || !debugInfo) return null;

    return (
      <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
            <Bug className="w-4 h-4" />
            Diagnóstico Meta Ads API
          </h3>
          <button 
            onClick={() => setDebugInfo(null)}
            className="text-amber-600 hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Action Types Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wider">Action Types Encontrados:</p>
              
              <div className="space-y-4">
                {/* Summary Level */}
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Account Summary (Valores Totais):</p>
                  <div className="flex flex-wrap gap-1">
                    {debugInfo.samples?.summary?.[0]?.actions?.length > 0 ? (
                      debugInfo.samples.summary[0].actions.map((a: any) => (
                        <span key={`sum_val_${a.action_type}`} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-[10px] font-mono">
                          {a.action_type}: <span className="font-bold">{a.value}</span>
                        </span>
                      ))
                    ) : <span className="text-[10px] text-slate-400 italic">Nenhum</span>}
                  </div>
                </div>

                {/* Campaign Level */}
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Campaign Level:</p>
                  <div className="flex flex-wrap gap-1">
                    {debugInfo.action_types_unique?.campaign?.length > 0 ? (
                      debugInfo.action_types_unique.campaign.map((type: string) => (
                        <span key={`camp_${type}`} className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-mono">
                          {type}
                        </span>
                      ))
                    ) : <span className="text-[10px] text-slate-400 italic">Nenhum</span>}
                  </div>
                </div>

                {/* Ad Level */}
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Ad Level:</p>
                  <div className="flex flex-wrap gap-1">
                    {debugInfo.action_types_unique?.ad?.length > 0 ? (
                      debugInfo.action_types_unique.ad.map((type: string) => (
                        <span key={`ad_${type}`} className="px-2 py-0.5 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 rounded text-[10px] font-mono">
                          {type}
                        </span>
                      ))
                    ) : <span className="text-[10px] text-slate-400 italic">Nenhum</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign Results Preview Section */}
            {debugInfo.campaign_results_preview && (
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wider">Cálculo de Resultados por Campanha:</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="text-left py-2 font-bold text-slate-400 uppercase">Campanha</th>
                        <th className="text-left py-2 font-bold text-slate-400 uppercase">Destino</th>
                        <th className="text-left py-2 font-bold text-slate-400 uppercase">Rótulo</th>
                        <th className="text-right py-2 font-bold text-slate-400 uppercase">Valor</th>
                        <th className="text-left py-2 font-bold text-slate-400 uppercase">Fonte/Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debugInfo.campaign_results_preview.map((item: any, i: number) => (
                        <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-medium">{item.campaign_name}</td>
                          <td className="py-2">
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              item.destination === 'instagram' ? 'bg-pink-100 text-pink-700' :
                              item.destination === 'whatsapp' ? 'bg-green-100 text-green-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {item.destination}
                            </span>
                          </td>
                          <td className="py-2 text-slate-500 italic">{item.results_label}</td>
                          <td className="py-2 text-right font-bold text-indigo-600">{item.results_value}</td>
                          <td className="py-2 text-slate-400 font-mono text-[9px]">{item.source_action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          
          {/* Params Section */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30 overflow-hidden">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wider">Parâmetros da Requisição:</p>
            <div className="space-y-4">
              {Object.entries(debugInfo.request_params_used || {}).map(([key, val]: [string, any]) => (
                <div key={key}>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">{key}:</p>
                  <pre className="text-[9px] bg-slate-50 dark:bg-slate-950 p-2 rounded overflow-x-auto text-slate-600 dark:text-slate-400">
                    {JSON.stringify(val, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }, [debugMode, debugInfo]);

  useEffect(() => {
    if (!clienteId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const clientSnap = await getDoc(doc(db, "clientes", clienteId));
        if (clientSnap.exists()) {
          const clientData = clientSnap.data() as Cliente;
          setCliente(clientData);

          let allMappedData: DadosCampanha[] = [];
          let metaErrorMsg = "";
          let googleErrorMsg = "";

          // --- FETCH META ADS ---
          if (clientData.meta_ads_conectado && clientData.meta_ads_account_id) {
            console.log(`[MetaAds] Iniciando busca de insights para conta: ${clientData.meta_ads_account_id}`);
            try {
              const metaAccSnap = await getDoc(doc(db, "meta_ads_accounts", clientData.meta_ads_account_id));
              
              if (metaAccSnap.exists()) {
                const metaAccData = metaAccSnap.data() as MetaAdsAccount;
                const accessToken = metaAccData.access_token;

                if (accessToken && metaAccData.status !== 'expired') {
                  const presetMap: Record<string, string> = {
                    "7": "last_7d", "15": "last_14d", "30": "last_30d",
                    "90": "last_90d", "180": "last_year", "365": "last_year", "max": "maximum"
                  };

                  let currentSince = "";
                  let currentUntil = "";
                  let prevSince = "";
                  let prevUntil = "";

                  if (dataInicio && dataFim) {
                    currentSince = dataInicio;
                    currentUntil = dataFim;
                    const start = parseISO(dataInicio);
                    const end = parseISO(dataFim);
                    const duration = differenceInDays(end, start) + 1;
                    prevSince = format(subDays(start, duration), 'yyyy-MM-dd');
                    prevUntil = format(subDays(start, 1), 'yyyy-MM-dd');
                  } else if (periodo !== "max") {
                    const days = parseInt(periodo);
                    const now = new Date();
                    currentSince = format(subDays(now, days), 'yyyy-MM-dd');
                    currentUntil = format(now, 'yyyy-MM-dd');
                    prevSince = format(subDays(now, days * 2), 'yyyy-MM-dd');
                    prevUntil = format(subDays(now, days + 1), 'yyyy-MM-dd');
                  } else {
                    currentSince = process.env.META_BACKFILL_START_DATE || '2023-01-01';
                    currentUntil = format(new Date(), 'yyyy-MM-dd');
                  }

                  const debugParam = debugMode ? "&debug=1&nocache=1" : "";
                  
                  // Fetch Current Period
                  const currentApiUrl = `/api/meta/insights?access_token=${encodeURIComponent(accessToken)}&ad_account_id=${encodeURIComponent(clientData.meta_ads_account_id)}&since=${encodeURIComponent(currentSince)}&until=${encodeURIComponent(currentUntil)}${debugParam}`;
                  const currentResponse = await fetch(currentApiUrl);
                  
                  if (currentResponse.ok) {
                    const result = await currentResponse.json();
                    const insights = result.data || [];
                    
                    if (result.debug) setDebugInfo(result.debug);
                    if (result.campaigns) setCampanhas(result.campaigns);
                    if (result.ad_totals) setAdTotals(result.ad_totals);
                    if (!clientData.google_ads_conectado) setSummary(result.summary);
                    
                    const mappedMeta = insights.map((insight: any, index: number) => ({
                      id: `meta_${insight.ad_id || index}_${insight.date_start || 'today'}`,
                      cliente_id: clienteId,
                      data: insight.date_start || new Date().toISOString().split('T')[0],
                      plataforma: 'meta_ads',
                      campanha_id_externo: insight.campaign_id || 'unknown',
                      campanha_nome: insight.campaign_name || 'Sem Nome',
                      adset_id_externo: insight.adset_id,
                      adset_nome: insight.adset_name,
                      ad_id_externo: insight.ad_id,
                      ad_nome: insight.ad_name,
                      investimento: parseFloat(insight.spend || 0),
                      impressoes: parseInt(insight.impressions || 0),
                      cliques: parseInt(insight.clicks || 0),
                      conversoes: parseInt(insight.leads || 0),
                      resultados: parseInt(insight.results_value || 0),
                      resultados_label: insight.results_label || "Resultados",
                      whatsapp_conversations: parseInt(insight.wa_conversations || insight.whatsapp_conversations || 0),
                      alcance: parseInt(insight.reach || 0),
                      frequencia: parseFloat(insight.frequency || 0),
                      cpc: parseFloat(insight.cpc || 0),
                      ctr: parseFloat(insight.ctr || 0),
                      cpa: parseInt(insight.leads || 0) > 0 ? parseFloat(insight.spend || 0) / parseInt(insight.leads || 1) : 0,
                      visitas_instagram: parseInt(insight.ig_visits || 0),
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    }));
                    allMappedData = [...allMappedData, ...mappedMeta];

                    // Fetch Previous Period for Comparison (only if not "max")
                    if (periodo !== "max" || (dataInicio && dataFim)) {
                      const prevApiUrl = `/api/meta/insights?access_token=${encodeURIComponent(accessToken)}&ad_account_id=${encodeURIComponent(clientData.meta_ads_account_id)}&since=${encodeURIComponent(prevSince)}&until=${encodeURIComponent(prevUntil)}`;
                      const prevResponse = await fetch(prevApiUrl);
                      if (prevResponse.ok) {
                        const prevResult = await prevResponse.json();
                        const prevInsights = prevResult.data || [];
                        const mappedPrevMeta = prevInsights.map((insight: any, index: number) => ({
                          id: `meta_prev_${insight.ad_id || index}_${insight.date_start || 'today'}`,
                          cliente_id: clienteId,
                          data: insight.date_start || new Date().toISOString().split('T')[0],
                          plataforma: 'meta_ads',
                          campanha_id_externo: insight.campaign_id || 'unknown',
                          campanha_nome: insight.campaign_name || 'Sem Nome',
                          investimento: parseFloat(insight.spend || 0),
                          impressoes: parseInt(insight.impressions || 0),
                          cliques: parseInt(insight.clicks || 0),
                          conversoes: parseInt(insight.leads || 0),
                          resultados: parseInt(insight.results_value || 0),
                          whatsapp_conversations: parseInt(insight.wa_conversations || insight.whatsapp_conversations || 0),
                          alcance: parseInt(insight.reach || 0),
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        }));
                        allMappedData = [...allMappedData, ...mappedPrevMeta];
                      }
                    }
                  } else {
                    const errorData = await currentResponse.json().catch(() => ({}));
                    metaErrorMsg = errorData.details?.error?.message || errorData.details?.message || errorData.error || "Erro na API Meta";
                  }
                } else {
                  metaErrorMsg = metaAccData.status === 'expired' ? "Conexão Meta expirada" : "Token Meta ausente";
                }
              }
            } catch (e) {
              console.error("[MetaAds] Erro:", e);
              metaErrorMsg = "Falha ao conectar com Meta Ads";
            }
          }

          // --- FETCH GOOGLE ADS ---
          if (clientData.google_ads_conectado && clientData.google_ads_customer_id) {
            console.log(`[GoogleAds] Iniciando busca de insights para conta: ${clientData.google_ads_customer_id}`);
            try {
              let currentSince = "";
              let currentUntil = "";
              let prevSince = "";
              let prevUntil = "";

              if (dataInicio && dataFim) {
                currentSince = dataInicio;
                currentUntil = dataFim;
                const start = parseISO(dataInicio);
                const end = parseISO(dataFim);
                const duration = differenceInDays(end, start) + 1;
                prevSince = format(subDays(start, duration), 'yyyy-MM-dd');
                prevUntil = format(subDays(start, 1), 'yyyy-MM-dd');
              } else if (periodo !== "max") {
                const days = parseInt(periodo);
                const now = new Date();
                currentSince = format(subDays(now, days), 'yyyy-MM-dd');
                currentUntil = format(now, 'yyyy-MM-dd');
                prevSince = format(subDays(now, days * 2), 'yyyy-MM-dd');
                prevUntil = format(subDays(now, days + 1), 'yyyy-MM-dd');
              } else {
                currentSince = '2023-01-01';
                currentUntil = format(new Date(), 'yyyy-MM-dd');
              }

              // Fetch Current Period
              const currentApiUrl = `/api/google/insights?customer_id=${encodeURIComponent(clientData.google_ads_customer_id)}&since=${encodeURIComponent(currentSince)}&until=${encodeURIComponent(currentUntil)}`;
              const currentResponse = await fetch(currentApiUrl);

              if (currentResponse.ok) {
                const result = await currentResponse.json();
                const insights = result.data || [];
                
                const mappedGoogle = insights.map((insight: any, index: number) => ({
                  id: `google_${insight.campaign_id}_${insight.date}`,
                  cliente_id: clienteId,
                  data: insight.date,
                  plataforma: 'google_ads',
                  campanha_id_externo: insight.campaign_id,
                  campanha_nome: insight.campaign_name,
                  investimento: insight.spend,
                  impressoes: insight.impressions,
                  cliques: insight.clicks,
                  conversoes: insight.conversions,
                  cpc: insight.cpc,
                  ctr: insight.ctr,
                  cpa: insight.cpa,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }));
                allMappedData = [...allMappedData, ...mappedGoogle];

                // Fetch Previous Period for Comparison
                if (periodo !== "max" || (dataInicio && dataFim)) {
                  const prevApiUrl = `/api/google/insights?customer_id=${encodeURIComponent(clientData.google_ads_customer_id)}&since=${encodeURIComponent(prevSince)}&until=${encodeURIComponent(prevUntil)}`;
                  const prevResponse = await fetch(prevApiUrl);
                  if (prevResponse.ok) {
                    const prevResult = await prevResponse.json();
                    const prevInsights = prevResult.data || [];
                    const mappedPrevGoogle = prevInsights.map((insight: any, index: number) => ({
                      id: `google_prev_${insight.campaign_id}_${insight.date}`,
                      cliente_id: clienteId,
                      data: insight.date,
                      plataforma: 'google_ads',
                      campanha_id_externo: insight.campaign_id,
                      campanha_nome: insight.campaign_name,
                      investimento: insight.spend,
                      impressoes: insight.impressions,
                      cliques: insight.clicks,
                      conversoes: insight.conversions,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    }));
                    allMappedData = [...allMappedData, ...mappedPrevGoogle];
                  }
                }
              } else {
                const errorData = await currentResponse.json().catch(() => ({}));
                googleErrorMsg = errorData.details || errorData.error || "Erro na API Google";
              }
            } catch (e) {
              console.error("[GoogleAds] Erro:", e);
              googleErrorMsg = "Falha ao conectar com Google Ads";
            }
          }

          // Finalizar processamento de dados
          setDados(allMappedData);
          if (allMappedData.length > 0) {
            syncToDatabase(allMappedData, clienteId);
          }

          // Consolidar erros
          if (metaErrorMsg && googleErrorMsg) setError(`Meta: ${metaErrorMsg} | Google: ${googleErrorMsg}`);
          else if (metaErrorMsg) setError(`Meta Ads: ${metaErrorMsg}`);
          else if (googleErrorMsg) setError(`Google Ads: ${googleErrorMsg}`);

        } else {
          setError("Cliente não encontrado.");
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setError("Erro ao carregar dados do cliente.");
      } finally {
        setLoading(false);
      }
    };

    const syncToDatabase = async (mappedData: DadosCampanha[], clienteId: string) => {
      try {
        console.log(`[Sync] Iniciando sincronização de ${mappedData.length} registros para o Firestore...`);
        const batch = mappedData.map(async (item) => {
          // Usar o ID único do anúncio + data para evitar duplicatas e garantir precisão
          const docId = `${clienteId}_${item.plataforma}_${item.ad_id_externo || item.campanha_id_externo}_${item.data}`;
          await setDoc(doc(db, "dados_campanhas", docId), item, { merge: true });
        });
        await Promise.all(batch);
        
        // Atualizar data de última sincronização do cliente
        await setDoc(doc(db, "clientes", clienteId), { 
          ultima_sincronizacao: new Date().toISOString() 
        }, { merge: true });
        
        console.log(`[Sync] Sincronização concluída com sucesso.`);
      } catch (syncError) {
        console.error(`[Sync] Erro ao sincronizar dados:`, syncError);
      }
    };

    fetchData();
  }, [clienteId, periodo, dataInicio, dataFim, debugMode]);

  const filteredData = useMemo(() => {
    let result = [...dados];

    // Filter by Period or Custom Date
    if (dataInicio && dataFim) {
      const start = startOfDay(parseISO(dataInicio));
      const end = endOfDay(parseISO(dataFim));
      result = result.filter(d => {
        const date = parseISO(d.data);
        return isWithinInterval(date, { start, end });
      });
    } else if (periodo !== "max") {
      const now = new Date();
      const startDate = startOfDay(subDays(now, parseInt(periodo)));
      result = result.filter(d => parseISO(d.data) >= startDate);
    }
    // If periodo is "max", we don't filter by date, showing everything returned by API

    // Filter by Platform
    if (filtroPlataforma !== "todas") {
      result = result.filter(d => d.plataforma === filtroPlataforma);
    }

    // Filter by Campaign Name
    if (filtroCampanha) {
      result = result.filter(d => 
        d.campanha_nome.toLowerCase().includes(filtroCampanha.toLowerCase())
      );
    }

    return result;
  }, [dados, periodo, dataInicio, dataFim, filtroPlataforma, filtroCampanha]);

  const metrics = useMemo(() => {
    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date;
    let prevStart: Date;
    let prevEnd: Date;

    if (dataInicio && dataFim) {
      currentStart = startOfDay(parseISO(dataInicio));
      currentEnd = endOfDay(parseISO(dataFim));
      const duration = differenceInDays(currentEnd, currentStart) + 1;
      prevStart = subDays(currentStart, duration);
      prevEnd = subDays(currentStart, 1);
    } else if (periodo !== "max") {
      const days = parseInt(periodo);
      currentStart = startOfDay(subDays(now, days));
      currentEnd = endOfDay(now);
      prevStart = startOfDay(subDays(now, days * 2));
      prevEnd = endOfDay(subDays(now, days + 1));
    } else {
      // For "max", we don't have a previous period
      currentStart = new Date(0);
      currentEnd = new Date();
      prevStart = new Date(0);
      prevEnd = new Date(0);
    }

    const currentData = dados.filter(d => {
      const date = parseISO(d.data);
      return isWithinInterval(date, { start: currentStart, end: currentEnd });
    });

    const previousData = dados.filter(d => {
      const date = parseISO(d.data);
      return isWithinInterval(date, { start: prevStart, end: prevEnd });
    });

    const calculateTotals = (data: DadosCampanha[]) => {
      return data.reduce((acc, curr) => ({
        investimento: acc.investimento + curr.investimento,
        cliques: acc.cliques + curr.cliques,
        impressoes: acc.impressoes + curr.impressoes,
        conversoes: acc.conversoes + curr.conversoes,
        resultados: acc.resultados + (curr.resultados || 0),
        alcance: acc.alcance + (curr.alcance || 0),
        whatsapp_conversations: acc.whatsapp_conversations + (curr.whatsapp_conversations || 0),
      }), { investimento: 0, cliques: 0, impressoes: 0, conversoes: 0, resultados: 0, alcance: 0, whatsapp_conversations: 0 });
    };

    const currentTotals = calculateTotals(currentData);
    const previousTotals = calculateTotals(previousData);

    // If we have summary from API and no filters, use it for current period (more accurate for Reach/Frequency)
    if (summary && filtroPlataforma === "todas" && !filtroCampanha) {
      currentTotals.investimento = parseFloat(summary.spend || 0);
      currentTotals.cliques = parseInt(summary.clicks || 0);
      currentTotals.impressoes = parseInt(summary.impressions || 0);
      currentTotals.conversoes = parseInt(summary.leads || 0);
      currentTotals.resultados = parseInt(summary.results_value || 0);
      currentTotals.alcance = parseInt(summary.reach || 0);
      currentTotals.whatsapp_conversations = parseInt(summary.wa_conversations || summary.whatsapp_conversations || 0);
    }

    const calculateMetrics = (totals: any) => {
      const cpc = totals.cliques > 0 ? totals.investimento / totals.cliques : 0;
      const ctr = totals.impressoes > 0 ? (totals.cliques / totals.impressoes) * 100 : 0;
      const cpa = totals.conversoes > 0 ? totals.investimento / totals.conversoes : 0;
      const cpl = totals.conversoes > 0 ? totals.investimento / totals.conversoes : 0;
      const cpwa = totals.whatsapp_conversations > 0 ? totals.investimento / totals.whatsapp_conversations : 0;
      const cpm = totals.impressoes > 0 ? (totals.investimento / totals.impressoes) * 1000 : 0;
      const frequencia = totals.alcance > 0 ? totals.impressoes / totals.alcance : 0;
      return { ...totals, cpc, ctr, cpa, cpl, cpwa, cpm, frequencia };
    };

    const currentMetrics = calculateMetrics(currentTotals);
    const previousMetrics = calculateMetrics(previousTotals);

    const calculateVariation = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? "100.0" : "0.0";
      return (((current - previous) / previous) * 100).toFixed(1);
    };

    const variations = {
      investimento: calculateVariation(currentMetrics.investimento, previousMetrics.investimento),
      conversoes: calculateVariation(currentMetrics.conversoes, previousMetrics.conversoes),
      cpl: calculateVariation(currentMetrics.cpl, previousMetrics.cpl),
      cpwa: calculateVariation(currentMetrics.cpwa, previousMetrics.cpwa),
      cliques: calculateVariation(currentMetrics.cliques, previousMetrics.cliques),
      impressoes: calculateVariation(currentMetrics.impressoes, previousMetrics.impressoes),
      whatsapp_conversations: calculateVariation(currentMetrics.whatsapp_conversations, previousMetrics.whatsapp_conversations),
    };

    const activeCampaigns = new Set(currentData.map(d => d.campanha_id_externo)).size;

    return { ...currentMetrics, variations, activeCampaigns };
  }, [dados, summary, filtroPlataforma, filtroCampanha, periodo, dataInicio, dataFim]);

  const chartData = useMemo(() => {
    const groups: Record<string, any> = {};
    
    // Get all days in the period to ensure no gaps
    const now = new Date();
    const start = dataInicio ? startOfDay(parseISO(dataInicio)) : 
                 (periodo === "max" ? (filteredData.length > 0 ? startOfDay(parseISO(filteredData.sort((a,b) => a.data.localeCompare(b.data))[0].data)) : subDays(now, 30)) : 
                 startOfDay(subDays(now, parseInt(periodo))));
    const end = dataFim ? endOfDay(parseISO(dataFim)) : endOfDay(now);
    
    // Limit interval to avoid performance issues if 'max' is too large, but for now let's try
    let days: Date[] = [];
    try {
      days = eachDayOfInterval({ start, end });
    } catch (e) {
      // Fallback if interval is invalid
      days = [start, end];
    }
    
    days.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      groups[dateStr] = { 
        date: format(day, "dd/MM"), 
        investimento: 0, 
        conversoes: 0,
        cliques: 0,
        impressoes: 0,
        whatsapp_conversations: 0,
        cpl: 0,
        cpwa: 0
      };
    });

    filteredData.forEach(d => {
      if (groups[d.data]) {
        groups[d.data].investimento += d.investimento;
        groups[d.data].conversoes += d.conversoes;
        groups[d.data].cliques += d.cliques;
        groups[d.data].impressoes += d.impressoes;
        groups[d.data].whatsapp_conversations += (d.whatsapp_conversations || 0);
      }
    });
    
    return Object.values(groups).map((g: any) => ({
      ...g,
      ctr: g.impressoes > 0 ? (g.cliques / g.impressoes) * 100 : 0,
      cpl: g.conversoes > 0 ? g.investimento / g.conversoes : 0,
      cpwa: g.whatsapp_conversations > 0 ? g.investimento / g.whatsapp_conversations : 0
    }));
  }, [filteredData, periodo, dataInicio, dataFim]);

  // Aggregated Detailed Report
  const campaignRanking = useMemo(() => {
    // Se tivermos dados de campanhas pré-agregados da API e não houver filtro de nome de campanha, use-os
    if (campanhas.length > 0 && !filtroCampanha && filtroPlataforma === "todas") {
      return campanhas.map(c => ({
        nome: c.campanha_nome,
        investimento: c.investimento,
        cliques: c.cliques,
        impressoes: c.impressoes,
        conversoes: c.conversoes,
        resultados: c.resultados,
        whatsapp_conversations: c.wa_conversations || c.whatsapp_conversations || 0,
        cpl: c.conversoes > 0 ? c.investimento / c.conversoes : 0,
        cpwa: (c.wa_conversations || c.whatsapp_conversations || 0) > 0 ? c.investimento / (c.wa_conversations || c.whatsapp_conversations) : 0,
        cpm: c.impressoes > 0 ? (c.investimento / c.impressoes) * 1000 : 0,
        ctr: c.impressoes > 0 ? (c.cliques / c.impressoes) * 100 : 0,
      })).sort((a, b) => b.investimento - a.investimento);
    }

    const report: Record<string, any> = {};
    filteredData.forEach(d => {
      const key = d.campanha_id_externo;
      if (!report[key]) {
        report[key] = {
          nome: d.campanha_nome,
          investimento: 0,
          cliques: 0,
          impressoes: 0,
          conversoes: 0,
          resultados: 0,
          whatsapp_conversations: 0,
        };
      }
      report[key].investimento += d.investimento;
      report[key].cliques += d.cliques;
      report[key].impressoes += d.impressoes;
      report[key].conversoes += d.conversoes;
      report[key].resultados += (d.resultados || 0);
      report[key].whatsapp_conversations += (d.whatsapp_conversations || 0);
    });

    return Object.values(report).map(r => ({
      ...r,
      cpl: r.conversoes > 0 ? r.investimento / r.conversoes : 0,
      cpwa: r.whatsapp_conversations > 0 ? r.investimento / r.whatsapp_conversations : 0,
      cpm: r.impressoes > 0 ? (r.investimento / r.impressoes) * 1000 : 0,
      ctr: r.impressoes > 0 ? (r.cliques / r.impressoes) * 100 : 0,
    })).sort((a, b) => b.investimento - a.investimento);
  }, [filteredData]);

  const adRanking = useMemo(() => {
    // Se temos os totais precisos do backend, use-os diretamente
    if (adTotals && adTotals.length > 0) {
      return adTotals.map(r => ({
        ad_id: r.ad_id,
        nome: r.ad_name,
        campanha: r.campaign_name,
        investimento: r.investimento,
        cliques: r.cliques,
        impressoes: r.impressoes,
        reach: r.reach,
        conversoes: r.conversoes,
        resultados: r.resultados,
        whatsapp_conversations: r.wa_conversations || r.whatsapp_conversations || 0,
        cpl: r.conversoes > 0 ? r.investimento / r.conversoes : 0,
        cpwa: (r.wa_conversations || r.whatsapp_conversations || 0) > 0 ? r.investimento / (r.wa_conversations || r.whatsapp_conversations) : 0,
        cpm: r.impressoes > 0 ? (r.investimento / r.impressoes) * 1000 : 0,
        ctr: r.impressoes > 0 ? (r.cliques / r.impressoes) * 100 : 0,
        frequency: r.frequency || (r.reach > 0 ? r.impressoes / r.reach : 1),
      })).sort((a, b) => b.conversoes - a.conversoes).slice(0, 10);
    }

    // Fallback para agregação manual (menos preciso para alcance/frequência)
    const report: Record<string, any> = {};
    filteredData.forEach(d => {
      const key = d.ad_nome || "Sem Nome";
      if (!report[key]) {
        report[key] = {
          nome: key,
          campanha: d.campanha_nome,
          investimento: 0,
          cliques: 0,
          impressoes: 0,
          reach: 0,
          conversoes: 0,
          resultados: 0,
          whatsapp_conversations: 0,
        };
      }
      report[key].investimento += d.investimento;
      report[key].cliques += d.cliques;
      report[key].impressoes += d.impressoes;
      report[key].reach += (d.alcance || 0);
      report[key].conversoes += d.conversoes;
      report[key].resultados += (d.resultados || 0);
      report[key].whatsapp_conversations += (d.whatsapp_conversations || 0);
    });

    return Object.values(report).map(r => ({
      ...r,
      cpl: r.conversoes > 0 ? r.investimento / r.conversoes : 0,
      cpwa: r.whatsapp_conversations > 0 ? r.investimento / r.whatsapp_conversations : 0,
      cpm: r.impressoes > 0 ? (r.investimento / r.impressoes) * 1000 : 0,
      ctr: r.impressoes > 0 ? (r.cliques / r.impressoes) * 100 : 0,
      frequency: r.reach > 0 ? r.impressoes / r.reach : 1,
    })).sort((a, b) => b.conversoes - a.conversoes).slice(0, 10);
  }, [filteredData, adTotals]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-500 dark:text-slate-400 font-medium">Carregando dados reais da Meta Ads...</p>
      {debugPanel}
    </div>
  );

  if (!cliente) return (
    <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
        <Target className="w-8 h-8 text-slate-400" />
      </div>
      <p className="text-slate-500 dark:text-slate-400 font-medium">Cliente não encontrado ou sem dados configurados.</p>
    </div>
  );

  if (error) {
    return (
      <div className="space-y-8">
        <DashboardHeader 
          cliente={cliente} 
          periodo={localPeriodo} 
          setPeriodo={setLocalPeriodo} 
          isInternal={isInternal}
          dataInicio={localDataInicio}
          setDataInicio={setLocalDataInicio}
          dataFim={localDataFim}
          setDataFim={setLocalDataFim}
          filtroPlataforma={localFiltroPlataforma}
          setFiltroPlataforma={setLocalFiltroPlataforma}
          filtroCampanha={localFiltroCampanha}
          setFiltroCampanha={setLocalFiltroCampanha}
          debugMode={debugMode}
          setDebugMode={setDebugMode}
          onApplyFilters={handleApplyFilters}
          showComparison={showComparison}
          setShowComparison={setShowComparison}
        />
        {debugPanel}
        <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/30 shadow-sm">
          <div className="p-4 bg-rose-50 dark:bg-rose-900/30 rounded-full">
            <Target className="w-8 h-8 text-rose-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Ops! Algo deu errado</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {error}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (dados.length === 0) {
    return (
      <div className="space-y-8">
        <DashboardHeader 
          cliente={cliente} 
          periodo={localPeriodo} 
          setPeriodo={setLocalPeriodo} 
          isInternal={isInternal}
          dataInicio={localDataInicio}
          setDataInicio={setLocalDataInicio}
          dataFim={localDataFim}
          setDataFim={setLocalDataFim}
          filtroPlataforma={localFiltroPlataforma}
          setFiltroPlataforma={setLocalFiltroPlataforma}
          filtroCampanha={localFiltroCampanha}
          setFiltroCampanha={setLocalFiltroCampanha}
          debugMode={debugMode}
          setDebugMode={setDebugMode}
          onApplyFilters={handleApplyFilters}
          showComparison={showComparison}
          setShowComparison={setShowComparison}
        />
        {debugPanel}
        <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
            <BarChart3 className="w-8 h-8 text-indigo-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum dado encontrado para este período</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {cliente.meta_ads_conectado 
                ? "A conta conectada não possui campanhas ativas ou dados registrados no período selecionado. Tente mudar o período ou ativar o modo Debug para auditar a conexão."
                : "Conecte uma conta de anúncios da Meta para visualizar métricas reais."}
            </p>
            <button 
              onClick={() => handleApplyFilters()}
              className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all"
            >
              Recarregar Dados
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardHeader 
        cliente={cliente} 
        periodo={localPeriodo} 
        setPeriodo={setLocalPeriodo} 
        isInternal={isInternal}
        dataInicio={localDataInicio}
        setDataInicio={setLocalDataInicio}
        dataFim={localDataFim}
        setDataFim={setLocalDataFim}
        filtroPlataforma={localFiltroPlataforma}
        setFiltroPlataforma={setLocalFiltroPlataforma}
        filtroCampanha={localFiltroCampanha}
        setFiltroCampanha={setLocalFiltroCampanha}
        debugMode={debugMode}
        setDebugMode={setDebugMode}
        onApplyFilters={handleApplyFilters}
        showComparison={showComparison}
        setShowComparison={setShowComparison}
      />

      {debugPanel}

      {/* Overview Cards */}
      <div className="space-y-6">
        {/* Row 1: Highlighted Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard 
            title="Investimento Total" 
            value={metrics.investimento} 
            type="currency" 
            icon={DollarSign} 
            color="indigo" 
            highlight
            variation={showComparison ? metrics.variations.investimento : null}
            legend={`Total investido no período`}
          />
          <MetricCard 
            title="Impressões" 
            value={metrics.impressoes} 
            type="number" 
            icon={Eye} 
            color="blue" 
            highlight
            variation={showComparison ? metrics.variations.impressoes : null}
            legend="Total de vezes que os anúncios foram exibidos"
          />
          <MetricCard 
            title="Conversas WA" 
            value={metrics.whatsapp_conversations} 
            type="number" 
            icon={Target} 
            color="emerald" 
            highlight
            variation={showComparison ? metrics.variations.whatsapp_conversations : null}
            legend="Total de conversas iniciadas"
          />
          <MetricCard 
            title="Custo por Conversas WA" 
            value={metrics.cpwa} 
            type="currency" 
            icon={Zap} 
            color="rose" 
            highlight
            variation={showComparison ? metrics.variations.cpwa : null}
            legend="Custo médio por conversa WA"
          />
          <MetricCard 
            title="Cliques no Link" 
            value={metrics.cliques} 
            type="number" 
            icon={MousePointer2} 
            color="amber" 
            highlight
            variation={showComparison ? metrics.variations.cliques : null}
            legend="Cliques totais nos anúncios"
          />
          <MetricCard 
            title="Cadastros Efetuados" 
            value={metrics.conversoes} 
            type="number" 
            icon={Users} 
            color="green" 
            highlight
            variation={showComparison ? metrics.variations.conversoes : null}
            legend="Total de cadastros no site"
          />
        </div>
      </div>

      {/* Rankings Section - Stacked Full Width */}
      <div className="space-y-8">
        <RankingTable 
          title="Ranking de Campanhas" 
          subtitle="Performance por campanha de anúncios"
          data={campaignRanking} 
          type="campaign"
          onItemClick={(item: any) => {
            setSelectedItem(item);
            setModalType("campaign");
          }}
          onHeaderIconClick={() => {
            setSelectedItem(campaignRanking);
            setModalType("all_campaigns");
          }}
        />
        <RankingTable 
          title="Melhores Anúncios" 
          subtitle="Top 10 anúncios por conversões"
          data={adRanking} 
          type="ad"
          onItemClick={(item: any) => {
            setSelectedItem(item);
            setModalType("ad");
          }}
          onHeaderIconClick={() => {
            setSelectedItem(campaignRanking);
            setModalType("all_campaigns");
          }}
        />
      </div>

      {/* Main Chart Section */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Evolução Diária</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Acompanhamento temporal das métricas de performance</p>
          </div>
          
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setActiveChart("performance")}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                activeChart === "performance" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              Investimento x Conversas WA x Custo/Conversa
            </button>
            <button 
              onClick={() => setActiveChart("engagement")}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                activeChart === "engagement" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              Cliques x CTR
            </button>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={activeChart === "performance" ? "#6366f1" : "#f59e0b"} stopOpacity={0.1}/>
                  <stop offset="95%" stopColor={activeChart === "performance" ? "#6366f1" : "#f59e0b"} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSecondary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={activeChart === "performance" ? "#10b981" : "#06b6d4"} stopOpacity={0.1}/>
                  <stop offset="95%" stopColor={activeChart === "performance" ? "#10b981" : "#06b6d4"} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
              <YAxis 
                yId="left" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#64748b', fontSize: 12}} 
                tickFormatter={(val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val)}
              />
              <YAxis yId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
              <Tooltip 
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                  borderColor: theme === 'dark' ? '#1e293b' : '#e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                }}
                itemStyle={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}
                labelStyle={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 'bold', marginBottom: '4px' }}
                labelFormatter={(val) => new Date(val).toLocaleDateString("pt-BR", { day: '2-digit', month: 'long' })}
                formatter={(value: any, name: string) => {
                  if (name.includes("(R$)")) return [new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value), name.replace(" (R$)", "")];
                  if (name.includes("(%)")) return [`${value.toFixed(2)}%`, name.replace(" (%)", "")];
                  return [value.toLocaleString('pt-BR'), name];
                }}
              />
              {activeChart === "performance" ? (
                <>
                  <Area yId="left" type="monotone" dataKey="investimento" name="Investimento (R$)" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPrimary)" />
                  <Area yId="right" type="monotone" dataKey="whatsapp_conversations" name="Conversas WA" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSecondary)" />
                  <Area yId="left" type="monotone" dataKey="cpwa" name="Custo/Conversa WA (R$)" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                </>
              ) : (
                <>
                  <Area yId="left" type="monotone" dataKey="cliques" name="Cliques" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorPrimary)" />
                  <Area yId="right" type="monotone" dataKey="ctr" name="CTR (%)" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorSecondary)" />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Traffic Funnel & Complementary Metrics - Moved Down */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <TrafficFunnel 
            impressions={metrics.impressoes}
            reach={metrics.alcance}
            clicks={metrics.cliques}
            leads={metrics.conversoes}
          />
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2">KPIs Complementares</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MiniMetricCard title="Campanhas Ativas" value={metrics.activeCampaigns} icon={Layers} color="slate" />
            <MiniMetricCard title="CTR Médio" value={metrics.ctr} type="percent" icon={TrendingUp} color="cyan" />
            <MiniMetricCard title="Frequência" value={metrics.frequencia} type="decimal" icon={Activity} color="violet" />
            <MiniMetricCard title="CPM Médio" value={metrics.cpm} type="currency" icon={Eye} color="blue" />
            <MiniMetricCard title="CPC Médio" value={metrics.cpc} type="currency" icon={MousePointer2} color="amber" />
          </div>
        </div>
      </div>

      {/* Details Modal */}
      <DetailsModal 
        item={selectedItem} 
        type={modalType} 
        onClose={() => {
          setSelectedItem(null);
          setModalType(null);
        }} 
      />

      {/* Platform Specific Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {(filtroPlataforma === "todas" || filtroPlataforma === "meta_ads") && (
          <PlatformSection 
            title="Meta Ads" 
            icon={Facebook} 
            color="blue" 
            data={filteredData.filter(d => d.plataforma === 'meta_ads')} 
          />
        )}
        {(filtroPlataforma === "todas" || filtroPlataforma === "google_ads") && (
          <PlatformSection 
            title="Google Ads" 
            icon={Globe} 
            color="emerald" 
            data={filteredData.filter(d => d.plataforma === 'google_ads')} 
          />
        )}
      </div>

      {/* Meta Ads Summary Section */}
      {(filtroPlataforma === "todas" || filtroPlataforma === "meta_ads") && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mt-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Facebook className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Resumo Meta Ads</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Valor Investido</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  filteredData.filter(d => d.plataforma === 'meta_ads').reduce((acc, curr) => acc + curr.investimento, 0)
                )}
              </p>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Conversas WA</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {filteredData.filter(d => d.plataforma === 'meta_ads').reduce((acc, curr) => acc + (curr.whatsapp_conversations || 0), 0).toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Cliques</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {filteredData.filter(d => d.plataforma === 'meta_ads').reduce((acc, curr) => acc + curr.cliques, 0).toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Alcance</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {filteredData.filter(d => d.plataforma === 'meta_ads').reduce((acc, curr) => acc + (curr.alcance || 0), 0).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardHeader({ 
  cliente, periodo, setPeriodo, isInternal,
  dataInicio, setDataInicio, dataFim, setDataFim,
  filtroPlataforma, setFiltroPlataforma,
  filtroCampanha, setFiltroCampanha,
  debugMode, setDebugMode,
  onApplyFilters,
  showComparison, setShowComparison
}: any) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={cn(
        "flex flex-col lg:flex-row lg:items-center justify-between gap-4",
        !isInternal && "bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 px-4 sm:px-6 lg:px-8 py-3 lg:py-4 lg:h-20 -mx-4 sm:-mx-6 lg:-mx-8 mb-4 sm:mb-8 transition-colors duration-300"
      )}>
        <div className="flex items-center gap-3 sm:gap-4">
          {!isInternal && cliente.logo_url ? (
            <img src={cliente.logo_url} alt={cliente.nome_cliente} className="h-7 sm:h-10 w-auto object-contain" referrerPolicy="no-referrer" />
          ) : !isInternal ? (
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm sm:text-base">
              {cliente.nome_cliente.charAt(0)}
            </div>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white truncate">{cliente.nome_cliente}</h1>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Performance Dashboard</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Comparison Toggle */}
          <button 
            onClick={() => setShowComparison(!showComparison)}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2 rounded-full text-[10px] sm:text-xs font-bold transition-all border",
              showComparison 
                ? "bg-indigo-600 border-indigo-600 text-white" 
                : "bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
            )}
            title="Comparar com o período anterior"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Comparar Períodos</span>
          </button>

          {/* Debug Toggle */}
          <button 
            onClick={() => setDebugMode(!debugMode)}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2 rounded-full text-[10px] sm:text-xs font-bold transition-all border",
              debugMode 
                ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400" 
                : "bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800/50 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title="Ativar modo de diagnóstico para auditoria de métricas"
          >
            <Bug className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{debugMode ? "Debug Ativo" : "Debug"}</span>
          </button>
          {/* Platform Toggle - Scrollable on very small screens */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-full overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setFiltroPlataforma("todas")}
              className={cn(
                "px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-full transition-all whitespace-nowrap",
                filtroPlataforma === "todas" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              Todas
            </button>
            <button 
              onClick={() => setFiltroPlataforma("meta_ads")}
              className={cn(
                "px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-full transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap",
                filtroPlataforma === "meta_ads" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              <Facebook className="w-3 h-3" />
              Meta
            </button>
            <button 
              onClick={() => setFiltroPlataforma("google_ads")}
              className={cn(
                "px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-full transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap",
                filtroPlataforma === "google_ads" ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              <Globe className="w-3 h-3" />
              Google
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-full text-[10px] sm:text-sm font-bold transition-all",
                showFilters ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              <Filter className="w-3.5 h-3.5 sm:w-4 h-4" />
              Filtros
            </button>
            
            <div className="relative flex-1 sm:flex-none">
              <select 
                value={periodo}
                onChange={(e) => {
                  setPeriodo(e.target.value);
                  setDataInicio("");
                  setDataFim("");
                }}
                className="w-full appearance-none bg-slate-100 dark:bg-slate-800 border-none rounded-full px-4 sm:px-6 py-2 pr-10 text-[10px] sm:text-sm font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
              >
                <option value="7">7 dias</option>
                <option value="15">15 dias</option>
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
                <option value="365">1 ano</option>
                <option value="max">Tudo</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 h-4 text-slate-500 dark:text-slate-400 pointer-events-none" />
            </div>

            {/* Update Button */}
            <button 
              onClick={onApplyFilters}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-[10px] sm:text-sm font-bold transition-all shadow-md shadow-indigo-200 dark:shadow-none"
            >
              <Activity className="w-3.5 h-3.5 sm:w-4 h-4" />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              Data Início
            </label>
            <input 
              type="date" 
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              Data Fim
            </label>
            <input 
              type="date" 
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1 space-y-2">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Search className="w-3 h-3" />
              Buscar Campanha
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Nome da campanha..."
                value={filtroCampanha}
                onChange={(e) => setFiltroCampanha(e.target.value)}
                className="w-full pl-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, type, icon: Icon, color, highlight, variation, legend }: any) {
  const formattedValue = useMemo(() => {
    if (type === 'currency') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    if (type === 'percent') return `${value.toFixed(2)}%`;
    if (type === 'decimal') return value.toFixed(2);
    return value.toLocaleString('pt-BR');
  }, [value, type]);

  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
    emerald: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    rose: "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400",
    amber: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    slate: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
    violet: "bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
    cyan: "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400",
    green: "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  };

  const hasVariation = variation !== null && variation !== undefined;
  const isPositive = hasVariation && parseFloat(variation) >= 0;

  return (
    <div className={cn(
      "bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group",
      highlight && "border-indigo-500/20 dark:border-indigo-500/10 ring-1 ring-indigo-500/5"
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2 rounded-xl transition-transform group-hover:scale-110", colors[color])}>
          <Icon className={cn("w-5 h-5", highlight && "w-6 h-6")} />
        </div>
        {hasVariation && (
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold",
            isPositive ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
          )}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(parseFloat(variation))}%
          </div>
        )}
      </div>
      <p className={cn("text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider", highlight && "text-indigo-500/70 dark:text-indigo-400/70")}>
        {title}
      </p>
      <p className={cn("text-2xl font-black text-slate-900 dark:text-white mt-1", highlight && "text-3xl")}>
        {formattedValue}
      </p>
      {legend && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium italic">
          {legend}
        </p>
      )}
    </div>
  );
}

function MiniMetricCard({ title, value, type, icon: Icon, color }: any) {
  const formattedValue = useMemo(() => {
    if (type === 'currency') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    if (type === 'percent') return `${value.toFixed(2)}%`;
    if (type === 'decimal') return value.toFixed(2);
    return value.toLocaleString('pt-BR');
  }, [value, type]);

  const colors: Record<string, string> = {
    indigo: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20",
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
    blue: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20",
    rose: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
    slate: "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800",
    violet: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20",
    cyan: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20",
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:border-indigo-200 dark:hover:border-indigo-800">
      <div className={cn("p-2 rounded-lg", colors[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{title}</p>
        <p className="text-sm font-black text-slate-900 dark:text-white">{formattedValue}</p>
      </div>
    </div>
  );
}

function TrafficFunnel({ impressions, reach, clicks, leads }: any) {
  const data = [
    { name: 'Impressões', value: impressions, color: '#6366f1', icon: Eye, width: '100%' },
    { name: 'Alcance', value: reach, color: '#818cf8', icon: Users, width: '85%' },
    { name: 'Cliques', value: clicks, color: '#a5b4fc', icon: MousePointer2, width: '70%' },
    { name: 'Contatos', value: leads, color: '#10b981', icon: Target, width: '55%' },
  ];

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const convRate = clicks > 0 ? (leads / clicks) * 100 : 0;

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-full">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Funil de Tráfego</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Jornada do usuário desde a visualização até a conversão</p>
        </div>
        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
          <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
      </div>

      <div className="flex flex-col items-center space-y-2">
        {data.map((item, idx) => {
          const Icon = item.icon;
          
          return (
            <div 
              key={item.name} 
              className="relative flex flex-col items-center transition-all duration-500 hover:scale-[1.02]"
              style={{ width: item.width }}
            >
              <div 
                className="w-full h-14 flex items-center justify-between px-8 rounded-xl text-white font-bold shadow-lg relative overflow-hidden group"
                style={{ 
                  backgroundColor: item.color,
                  opacity: 1 - (idx * 0.1)
                }}
              >
                {/* Decorative background pattern */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                
                <div className="flex items-center gap-3 relative z-10">
                  <div className="p-1.5 bg-white/20 rounded-lg">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black">{item.name}</span>
                </div>
                
                <div className="text-right relative z-10">
                  <span className="text-sm sm:text-base font-black">{item.value.toLocaleString('pt-BR')}</span>
                </div>
              </div>

              {/* Tapered connector */}
              {idx < data.length - 1 && (
                <div 
                  className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[10px] my-1 opacity-30"
                  style={{ borderTopColor: item.color }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
        <div className="text-center p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-800/30">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Taxa de Cliques (CTR)</p>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{ctr.toFixed(2)}%</p>
        </div>
        <div className="text-center p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100/50 dark:border-emerald-800/30">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Taxa de Conversão</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{convRate.toFixed(2)}%</p>
        </div>
      </div>
    </div>
  );
}

function RankingTable({ title, subtitle, data, type, onItemClick, onHeaderIconClick }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <button 
          onClick={onHeaderIconClick}
          className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all group"
          title="Ver performance por campanhas"
        >
          <BarChart3 className="w-5 h-5 transition-transform group-hover:scale-110" />
        </button>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {type === 'campaign' ? 'Campanha' : 'Anúncio'}
              </th>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Investimento</th>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Cadastros</th>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Conversas WA</th>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Custo/Conversa WA</th>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">CTR</th>
              {type === 'ad' && (
                <>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Freq.</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">CPM</th>
                </>
              )}
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.length === 0 ? (
              <tr>
                <td colSpan={type === 'campaign' ? 8 : 7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 italic text-sm">
                  Nenhum dado disponível.
                </td>
              </tr>
            ) : (
              data.map((item: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[180px]">{item.nome}</p>
                        {type === 'ad' && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[180px]">{item.campanha}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.investimento)}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.conversoes.toLocaleString('pt-BR')}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{(item.whatsapp_conversations || 0).toLocaleString('pt-BR')}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.cpwa)}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-xs text-slate-600 dark:text-slate-400">{item.ctr.toFixed(2)}%</p>
                  </td>
                  {type === 'ad' && (
                    <>
                      <td className="px-6 py-4 text-right">
                        <p className="text-xs text-slate-600 dark:text-slate-400">{item.frequency.toFixed(2)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.cpm)}
                        </p>
                      </td>
                    </>
                  )}
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => onItemClick(item)}
                      className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-all"
                      title="Ver detalhes"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlatformSection({ title, icon: Icon, color, data }: any) {
  const metrics = useMemo(() => {
    const total = data.reduce((acc: any, curr: any) => ({
      investimento: acc.investimento + curr.investimento,
      cliques: acc.cliques + curr.cliques,
      conversoes: acc.conversoes + curr.conversoes,
      whatsapp_conversations: (acc.whatsapp_conversations || 0) + (curr.whatsapp_conversations || 0),
      alcance: (acc.alcance || 0) + (curr.alcance || 0),
      posicao: (acc.posicao || 0) + (curr.posicao_media || 0),
    }), { investimento: 0, cliques: 0, conversoes: 0, alcance: 0, posicao: 0 });

    return total;
  }, [data]);

  const colors: Record<string, string> = {
    blue: "bg-blue-600 text-white",
    emerald: "bg-emerald-600 text-white",
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", colors[color])}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Investimento</p>
          <p className="font-bold text-slate-900 dark:text-white">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.investimento)}
          </p>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Cliques</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{metrics.cliques.toLocaleString('pt-BR')}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
              {title === 'Meta Ads' ? 'Conversas WA' : 'Conversões'}
            </p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {title === 'Meta Ads' 
                ? (metrics.whatsapp_conversations || 0).toLocaleString('pt-BR') 
                : metrics.conversoes.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
              {title === 'Meta Ads' ? 'Alcance' : 'Posição Média'}
            </p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {title === 'Meta Ads' 
                ? metrics.alcance.toLocaleString('pt-BR') 
                : (metrics.posicao / (data.length || 1)).toFixed(1)}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Campanhas Ativas</h4>
          <div className="space-y-2">
            {data.slice(0, 3).map((camp: any) => (
              <div key={camp.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-all">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{camp.campanha_nome}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">ID: {camp.campanha_id_externo}</p>
                </div>
                <div className="text-right ml-4 space-y-1">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Investido</span>
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(camp.investimento)}
                    </p>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">
                        {title === 'Meta Ads' ? 'Conv. WA' : 'Contatos'}
                      </span>
                      <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {title === 'Meta Ads' ? (camp.whatsapp_conversations || 0) : camp.conversoes}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">CPM</span>
                      <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(camp.cpm || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailsModal({ item, type, onClose }: any) {
  if (!item) return null;

  const isAllCampaigns = type === "all_campaigns";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={cn(
        "bg-white dark:bg-slate-900 w-full rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200",
        isAllCampaigns ? "max-w-4xl" : "max-w-2xl"
      )}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {isAllCampaigns ? 'Performance por Campanhas' : `Detalhes ${type === 'campaign' ? 'da Campanha' : 'do Anúncio'}`}
              </h2>
              {!isAllCampaigns && <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">{item.nome}</p>}
              {isAllCampaigns && <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Resumo de todas as campanhas no período</p>}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {isAllCampaigns ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {item.map((camp: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-black text-slate-900 dark:text-white line-clamp-2">{camp.nome}</p>
                      <div className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded text-[10px] font-bold">
                        #{idx + 1}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Investimento</p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(camp.investimento)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Conversas WA</p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{(camp.whatsapp_conversations || 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Custo/Conversa WA</p>
                        <p className="text-xs font-bold text-rose-500">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(camp.cpwa)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">CTR</p>
                        <p className="text-xs font-bold text-emerald-500">{camp.ctr.toFixed(2)}%</p>
                      </div>
                    </div>

                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500" 
                        style={{ width: `${item[0].investimento > 0 ? (camp.investimento / item[0].investimento) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                <ModalMetric label="Investimento" value={item.investimento} type="currency" icon={DollarSign} color="indigo" />
                <ModalMetric label="Conversas WA" value={item.whatsapp_conversations} type="number" icon={Target} color="emerald" />
                <ModalMetric label="Custo/Conversa WA" value={item.cpwa} type="currency" icon={Zap} color="rose" />
                <ModalMetric label="Cadastros" value={item.conversoes} type="number" icon={Users} color="green" />
                <ModalMetric label="Cliques" value={item.cliques} type="number" icon={MousePointer2} color="amber" />
                <ModalMetric label="CTR" value={item.ctr || (item.impressoes > 0 ? (item.cliques / item.impressoes) * 100 : 0)} type="percent" icon={TrendingUp} color="cyan" />
                <ModalMetric label="Impressões" value={item.impressoes} type="number" icon={Eye} color="blue" />
              </div>

              <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Informações Adicionais</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Plataforma</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Meta Ads</p>
                  </div>
                  {type === 'ad' && (
                    <>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Campanha</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.campanha}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Frequência</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{item.frequency.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">CPM</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.cpm)}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:opacity-90 transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalMetric({ label, value, type, icon: Icon, color }: any) {
  const formattedValue = useMemo(() => {
    if (type === 'currency') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    if (type === 'percent') return `${value.toFixed(2)}%`;
    return value.toLocaleString('pt-BR');
  }, [value, type]);

  const colors: Record<string, string> = {
    indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30",
    emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30",
    rose: "text-rose-600 bg-rose-50 dark:bg-rose-900/30",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-900/30",
    cyan: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30",
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-900/30",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn("p-1.5 rounded-lg", colors[color])}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-lg font-black text-slate-900 dark:text-white">{formattedValue}</p>
    </div>
  );
}
