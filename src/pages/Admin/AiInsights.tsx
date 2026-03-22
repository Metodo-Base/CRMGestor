import { useState, useEffect, ReactNode } from "react";
import { collection, onSnapshot, query, orderBy, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Cliente } from "../../types";
import OpenAI from "openai";
import { 
  Brain, 
  Calendar, 
  Users, 
  Play, 
  Loader2, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Lightbulb, 
  ArrowRight,
  Settings,
  Save,
  ChevronDown,
  Sparkles,
  Target,
  BarChart3,
  Zap,
  Key,
  DollarSign,
  Eye,
  Globe,
  MousePointer2,
  MessageSquare,
  Activity,
  ClipboardList,
  ShieldAlert,
  LayoutDashboard,
  Award,
  Flame,
  Filter
} from "lucide-react";
import { cn } from "../../lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area
} from 'recharts';

interface AiAnalysis {
  resumo_executivo: string;
  saude_metricas: string;
  pontos_fortes: string;
  gargalos_fugas: string;
  plano_acao_gerencial: string;
  funil_trafego: {
    etapa: string;
    valor: number;
    porcentagem: number;
    cor: string;
  }[];
  ranking_campanhas: {
    nome: string;
    metrica_principal: string;
    valor: number;
    posicao: number;
  }[];
  melhores_anuncios: {
    titulo: string;
    performance: string;
    ctr: number;
    custo_resultado: number;
  }[];
  diagnostico_detalhado: {
    campanhas: {
      nome: string;
      investimento: number;
      resultados: string;
      ctr: number;
      cpm: number;
      frequencia: number;
      custo_resultado: number;
      veredicto: string;
      status: 'ok' | 'warning' | 'critical';
    }[];
  };
  principais_problemas: {
    titulo: string;
    descricao: string;
  }[];
  plano_acao: {
    titulo: string;
    acoes: string[];
    tags: { label: string; type: 'danger' | 'success' | 'info' }[];
  }[];
  health_score: {
    label: string;
    atual: string;
    meta: string;
    porcentagem: number;
    status: 'success' | 'warning' | 'danger';
  }[];
  alertas: {
    tipo: 'red' | 'orange' | 'green' | 'purple';
    titulo: string;
    descricao: string;
  }[];
}

interface CampaignData {
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  results: number; // Leads (Cadastros)
  wa_conversations: number; // Conversas WA
  costPerResult: number;
  frequency: number;
  reach: number;
}

export default function AiInsights() {
  const [activeTab, setActiveTab] = useState<'kpis' | 'graficos' | 'tabelas' | 'health' | 'analise'>('kpis');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(format(new Date(new Date().setDate(new Date().getDate() - 30)), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [rawInsights, setRawInsights] = useState<CampaignData[]>([]);
  const [totals, setTotals] = useState({
    spend: 0,
    impressions: 0,
    clicks: 0,
    reach: 0,
    frequency: 0,
    ctr: 0,
    cpm: 0,
    results: 0,
    costPerResult: 0
  });
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [showPromptConfig, setShowPromptConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "clientes"), orderBy("nome_cliente", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Cliente[];
      
      // Filter out clients that don't have Meta Ads connection, have fake names, or have no name
      const fakeNames = ["exemplo", "teste", "mock", "fake", "ficticia", "fictícia", "silva advogados", "clínica sorriso", "techworld", "imobiliária horizonte"];
      const isFake = (name: string) => {
        if (!name || name.trim() === "") return true;
        return fakeNames.some(fake => name.toLowerCase().includes(fake));
      };
      
      const realClients = data.filter(c => 
        c.meta_ads_conectado && 
        !isFake(c.nome_cliente) &&
        !( (!c.nome_cliente || c.nome_cliente.trim() === "") && c.ultima_sincronizacao?.includes("2026-03-17T19:15:18") )
      );
      setClientes(realClients);
    });

    // Load Config from Firestore
    const loadConfig = async () => {
      const snap = await getDoc(doc(db, "config_ia", "default"));
      if (snap.exists()) {
        const data = snap.data();
        setApiKey(data.api_key_ia || "");
        setPrompt(data.prompt_analise || `Atue como um Estrategista Sênior de Tráfego Pago e Especialista em Conversão, com ampla experiência em otimização de campanhas digitais e geração de leads. Vou te fornecer os dados de performance das campanhas de anúncios do meu cliente, cujo objetivo principal é a geração de Contatos/Cadastros (Leads) e Conversas no WhatsApp. 

Por favor, analise os dados fornecidos e crie um relatório gerencial detalhado, profissional e didático, que esteja pronto para ser apresentado ao cliente final. 

Estruture sua resposta obrigatoriamente nos seguintes tópicos:

1. Resumo Executivo: Forneça uma visão geral em um parágrafo sobre o desempenho geral do período, comparando o Investimento total com o Volume de conversões geradas.
2. Saúde das Métricas: Realize uma avaliação crítica do Custo por Contato (CPA), da Taxa de Clique (CTR) e da proporção entre Cliques no Link e Conversões reais (WhatsApp/Leads). Os custos estão saudáveis?
3. Pontos Fortes: Destaque as campanhas ou anúncios específicos que estão gerando os melhores resultados, explicando o motivo provável para isso.
4. Gargalos e Fugas de Verba: Identifique áreas onde estamos perdendo dinheiro, como campanhas com alto gasto e baixo retorno, ou anúncios com CTR elevado que não resultam em conversões na Landing Page ou no WhatsApp.
5. Plano de Ação Prático: Forneça de 3 a 5 recomendações diretas e acionáveis para otimização imediata, como pausar campanhas ineficazes, realocar orçamento, testar novos criativos ou melhorar a proposta da landing page.`);
      }
    };
    loadConfig();

    return () => unsubscribe();
  }, []);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await setDoc(doc(db, "config_ia", "default"), {
        api_key_ia: apiKey,
        updated_at: new Date().toISOString()
      }, { merge: true });
      setShowConfig(false);
    } catch (error) {
      console.error("Erro ao salvar config:", error);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      await setDoc(doc(db, "config_ia", "default"), {
        prompt_analise: prompt,
        updated_at: new Date().toISOString()
      }, { merge: true });
      setShowPromptConfig(false);
    } catch (error) {
      console.error("Erro ao salvar prompt:", error);
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleAnalyze = async () => {
    setError(null);
    setSuccess(null);

    if (!selectedCliente) {
      setError("Por favor, selecione um cliente.");
      return;
    }

    if (!apiKey) {
      setError("Por favor, configure a chave da API da OpenAI primeiro.");
      setShowConfig(true);
      return;
    }

    setLoading(true);
    setAnalysis(null);

    try {
      // 1. Fetch client data to get Meta Ads credentials
      const clientSnap = await getDoc(doc(db, "clientes", selectedCliente));
      if (!clientSnap.exists()) throw new Error("Cliente não encontrado.");
      const clientData = clientSnap.data() as Cliente;

      if (!clientData.meta_ads_account_id) throw new Error("Cliente não possui conta Meta Ads vinculada.");

      // 2. Fetch Meta Ads Access Token
      const metaAccSnap = await getDoc(doc(db, "meta_ads_accounts", clientData.meta_ads_account_id));
      if (!metaAccSnap.exists()) throw new Error("Configuração Meta Ads não encontrada.");
      const metaAccData = metaAccSnap.data();
      const accessToken = metaAccData.access_token;

      if (!accessToken) throw new Error("Token de acesso Meta Ads não encontrado.");

      // 3. Fetch Insights from Meta Ads API
      const apiUrl = `/api/meta/insights?access_token=${encodeURIComponent(accessToken)}&ad_account_id=${encodeURIComponent(clientData.meta_ads_account_id)}&since=${startDate}&until=${endDate}`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("Erro ao buscar dados da Meta Ads.");
      
      const result = await response.json();
      const insights = result.data || [];

      if (insights.length === 0) {
        setError("Nenhum dado de campanha encontrado para este período.");
        setLoading(false);
        return;
      }

      // 4. Prepare data for UI and AI
      const mappedInsights: CampaignData[] = insights.map((i: any) => {
        const spend = Number(i.spend || 0);
        const impressions = Number(i.impressions || 0);
        const clicks = Number(i.clicks || 0);
        const results = Number(i.leads || 0);
        const wa_conversations = Number(i.wa_conversations || 0);
        const total_conversions = results + wa_conversations;
        
        return {
          name: i.campaign_name,
          spend,
          impressions,
          clicks,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
          results,
          wa_conversations,
          costPerResult: total_conversions > 0 ? spend / total_conversions : 0,
          frequency: Number(i.frequency || 1),
          reach: Number(i.reach || 0)
        };
      });

      setRawInsights(mappedInsights);

      // Calculate Totals
      const totalSpend = mappedInsights.reduce((acc, curr) => acc + curr.spend, 0);
      const totalImpressions = mappedInsights.reduce((acc, curr) => acc + curr.impressions, 0);
      const totalClicks = mappedInsights.reduce((acc, curr) => acc + curr.clicks, 0);
      const totalResults = mappedInsights.reduce((acc, curr) => acc + curr.results, 0);
      const totalWaConversations = mappedInsights.reduce((acc, curr) => acc + curr.wa_conversations, 0);
      const totalReach = mappedInsights.reduce((acc, curr) => acc + curr.reach, 0);
      const totalConversions = totalResults + totalWaConversations;
      
      setTotals({
        spend: totalSpend,
        impressions: totalImpressions,
        clicks: totalClicks,
        reach: totalReach,
        frequency: totalImpressions / totalReach || 1,
        ctr: (totalClicks / totalImpressions) * 100 || 0,
        cpm: (totalSpend / totalImpressions) * 1000 || 0,
        results: totalResults,
        costPerResult: totalSpend / totalConversions || 0
      });

      const dataString = JSON.stringify(mappedInsights, null, 2);

      // 5. Call OpenAI API
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });
      
      const systemInstruction = `Você é um Estrategista Sênior de Tráfego Pago e Especialista em Conversão. 
      Sua tarefa é analisar os dados e gerar um RELATÓRIO GERENCIAL DETALHADO seguindo a estrutura JSON.
      Foque em clareza, didática e insights acionáveis.
      Use uma linguagem profissional e executiva.`;

      const userPrompt = `${prompt}
      
      Dados das campanhas do cliente ${clientData.nome_cliente}:
      ${dataString}
      
      Observação: 'results' refere-se a Cadastros/Leads e 'wa_conversations' refere-se a Conversas no WhatsApp.
      
      Retorne o resultado EXATAMENTE no seguinte formato JSON:
      {
        "resumo_executivo": "Texto do Resumo Executivo (Tópico 1)",
        "saude_metricas": "Texto da Análise de Saúde das Métricas (Tópico 2)",
        "pontos_fortes": "Texto dos Pontos Fortes (Tópico 3)",
        "gargalos_fugas": "Texto dos Gargalos e Fugas de Verba (Tópico 4)",
        "plano_acao_gerencial": "Texto do Plano de Ação Prático (Tópico 5)",
        "funil_trafego": [
          { "etapa": "Impressões", "valor": 100000, "porcentagem": 100, "cor": "#6366f1" },
          { "etapa": "Cliques", "valor": 2000, "porcentagem": 2, "cor": "#8b5cf6" },
          { "etapa": "Conversões Totais", "valor": 150, "porcentagem": 7.5, "cor": "#ec4899" }
        ],
        "ranking_campanhas": [
          { "nome": "Campanha X", "metrica_principal": "CPA", "valor": 4.5, "posicao": 1 }
        ],
        "melhores_anuncios": [
          { "titulo": "Criativo Vídeo A", "performance": "Excelente", "ctr": 2.5, "custo_resultado": 8.5 }
        ],
        "diagnostico_detalhado": {
          "campanhas": [
            {
              "nome": "Nome da Campanha",
              "investimento": 123.45,
              "resultados": "X resultados",
              "ctr": 1.5,
              "cpm": 12.5,
              "frequencia": 1.2,
              "custo_resultado": 15.0,
              "veredicto": "Texto curto de veredicto",
              "status": "ok | warning | critical"
            }
          ]
        },
        "principais_problemas": [
          { "titulo": "Título do Problema", "descricao": "Descrição detalhada do impacto e causa." }
        ],
        "plano_acao": [
          { 
            "titulo": "Título da Etapa (ex: IMEDIATO, CURTO PRAZO)", 
            "acoes": ["Ação 1", "Ação 2"],
            "tags": [{ "label": "PAUSAR", "type": "danger" }, { "label": "MANTER", "type": "success" }]
          }
        ],
        "health_score": [
          { "label": "CTR Geral", "atual": "1.5%", "meta": "≥ 2.0%", "porcentagem": 75, "status": "warning" },
          { "label": "Custo por Resultado", "atual": "R$ 15,00", "meta": "≤ R$ 10,00", "porcentagem": 60, "status": "danger" }
        ],
        "alertas": [
          { "tipo": "red | orange | green | purple", "titulo": "Título do Alerta", "descricao": "Texto do alerta" }
        ]
      }`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      });

      const content = JSON.parse(aiResponse.choices[0].message.content || "{}");
      
      setAnalysis(content);
      setActiveTab('analise'); // Go to analysis tab after generation
      setSuccess("Análise concluída com sucesso!");
    } catch (error: any) {
      console.error("Erro na análise IA:", error);
      setError(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <Brain className="w-8 h-8 text-white" />
            </div>
            Insights de IA
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Análise inteligente de performance e sugestões de otimização</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setShowPromptConfig(!showPromptConfig);
              setShowConfig(false);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 rounded-xl transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Configurar Prompt
          </button>
          <button 
            onClick={() => {
              setShowConfig(!showConfig);
              setShowPromptConfig(false);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 rounded-xl transition-all"
          >
            <Settings className="w-4 h-4" />
            Configurar API
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 py-4 rounded-2xl text-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="hover:text-red-800 dark:hover:text-red-300">×</button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 px-6 py-4 rounded-2xl text-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="hover:text-emerald-800 dark:hover:text-emerald-300">×</button>
        </div>
      )}

      {/* Prompt Config Section */}
      {showPromptConfig && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 shadow-sm animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 dark:text-white">Prompt de Análise</h3>
          </div>
          <div className="space-y-4">
            <textarea 
              rows={4}
              placeholder="Digite o prompt que a IA usará para analisar os dados..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none font-medium"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="flex justify-end">
              <button 
                onClick={handleSavePrompt}
                disabled={savingPrompt}
                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {savingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Prompt
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Este prompt será enviado à IA junto com as métricas do cliente selecionado.</p>
        </div>
      )}

      {/* API Config Section */}
      {showConfig && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 shadow-sm animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 dark:text-white">Chave da API (OpenAI)</h3>
          </div>
          <div className="flex gap-4">
            <input 
              type="password"
              placeholder="Digite sua chave da API da OpenAI..."
              className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button 
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Sua chave é armazenada de forma segura e usada apenas para as análises.</p>
        </div>
      )}

      {/* Selection Context */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Users className="w-3 h-3" />
              Selecionar Cliente
            </label>
            <div className="relative">
              <select 
                className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 appearance-none focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all cursor-pointer font-medium"
                value={selectedCliente}
                onChange={(e) => setSelectedCliente(e.target.value)}
              >
                <option value="">Escolha um cliente...</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome_cliente}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              Data Inicial
            </label>
            <input 
              type="date"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              Data Final
            </label>
            <input 
              type="date"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <button 
            onClick={handleAnalyze}
            disabled={loading || !selectedCliente}
            className={cn(
              "group relative px-12 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none overflow-hidden",
              loading && "pr-16"
            )}
          >
            <div className="flex items-center gap-3 relative z-10">
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Analisando dados...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                  Analisar Campanhas
                </>
              )}
            </div>
            {!loading && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            )}
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      {analysis && (
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
          {[
            { id: 'kpis', label: 'KPIs', icon: Activity },
            { id: 'graficos', label: 'Gráficos', icon: BarChart3 },
            { id: 'tabelas', label: 'Tabelas', icon: ClipboardList },
            { id: 'health', label: 'Health Score', icon: ShieldAlert },
            { id: 'analise', label: 'Análise Estratégica', icon: Sparkles },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Results Area */}
      {analysis && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* TAB: KPIs */}
          {activeTab === 'kpis' && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KpiCard 
                  icon={<DollarSign className="w-4 h-4" />}
                  label="Investimento"
                  value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.spend)}
                  subLabel="Total no período"
                  color="indigo"
                />
                <KpiCard 
                  icon={<Eye className="w-4 h-4" />}
                  label="Impressões"
                  value={totals.impressions.toLocaleString('pt-BR')}
                  subLabel="Visualizações totais"
                  color="blue"
                />
                <KpiCard 
                  icon={<Globe className="w-4 h-4" />}
                  label="Alcance"
                  value={totals.reach.toLocaleString('pt-BR')}
                  subLabel="Pessoas únicas"
                  color="cyan"
                />
                <KpiCard 
                  icon={<TrendingUp className="w-4 h-4" />}
                  label="CTR Médio"
                  value={`${totals.ctr.toFixed(2)}%`}
                  subLabel="Taxa de clique"
                  color="emerald"
                />
                <KpiCard 
                  icon={<Zap className="w-4 h-4" />}
                  label="CPM Médio"
                  value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.cpm)}
                  subLabel="Custo por mil"
                  color="purple"
                />
                <KpiCard 
                  icon={<Activity className="w-4 h-4" />}
                  label="Frequência"
                  value={totals.frequency.toFixed(2)}
                  subLabel="Repetições por pessoa"
                  color="orange"
                />
                <KpiCard 
                  icon={<MousePointer2 className="w-4 h-4" />}
                  label="Cliques"
                  value={totals.clicks.toLocaleString('pt-BR')}
                  subLabel="Cliques no link"
                  color="blue"
                />
                <KpiCard 
                  icon={<MessageSquare className="w-4 h-4" />}
                  label="Resultados"
                  value={totals.results.toLocaleString('pt-BR')}
                  subLabel="Leads / Conversas"
                  color="green"
                />
                <KpiCard 
                  icon={<Target className="w-4 h-4" />}
                  label="Custo/Result."
                  value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.costPerResult)}
                  subLabel="Média por lead"
                  color="red"
                />
              </div>

              {/* AI Alerts in KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.alertas.map((alerta, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "p-4 rounded-2xl border flex gap-4 items-start",
                      alerta.tipo === 'red' && "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-900 dark:text-red-200",
                      alerta.tipo === 'orange' && "bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30 text-orange-900 dark:text-orange-200",
                      alerta.tipo === 'green' && "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200",
                      alerta.tipo === 'purple' && "bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30 text-purple-900 dark:text-purple-200"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg shrink-0",
                      alerta.tipo === 'red' && "bg-red-500/20",
                      alerta.tipo === 'orange' && "bg-orange-500/20",
                      alerta.tipo === 'green' && "bg-emerald-500/20",
                      alerta.tipo === 'purple' && "bg-purple-500/20"
                    )}>
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm uppercase tracking-tight mb-1">{alerta.titulo}</h4>
                      <p className="text-xs opacity-80 leading-relaxed font-medium">{alerta.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: Gráficos */}
          {activeTab === 'graficos' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight">Performance: Investimento vs Resultados</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={rawInsights}>
                      <defs>
                        <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" hide />
                      <YAxis yAxisId="left" orientation="left" stroke="#6366f1" fontSize={10} />
                      <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any, name: string) => [
                          name === 'spend' ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) : value,
                          name === 'spend' ? 'Investimento' : 'Resultados'
                        ]}
                      />
                      <Area yAxisId="left" type="monotone" dataKey="spend" stroke="#6366f1" fillOpacity={1} fill="url(#colorSpend)" />
                      <Bar yAxisId="right" dataKey="results" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight">Custo por Resultado</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rawInsights}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" hide />
                      <YAxis stroke="#ef4444" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value), 'Custo/Res']}
                      />
                      <Bar dataKey="costPerResult" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight">Eficiência (CTR %)</h3>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rawInsights}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" hide />
                      <YAxis stroke="#10b981" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`${value.toFixed(2)}%`, 'CTR']}
                      />
                      <Line type="monotone" dataKey="ctr" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Tabelas */}
          {activeTab === 'tabelas' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Campanha</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Invest.</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Result.</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Custo/Res.</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">CTR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rawInsights.map((camp, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3 font-bold text-slate-900 dark:text-white text-xs max-w-[200px] truncate">{camp.name}</td>
                        <td className="px-6 py-3 text-right font-medium text-slate-600 dark:text-slate-400 text-xs">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(camp.spend)}
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-slate-600 dark:text-slate-400 text-xs">{camp.results}</td>
                        <td className="px-6 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(camp.costPerResult)}
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-slate-600 dark:text-slate-400 text-xs">{camp.ctr.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: Health Score */}
          {activeTab === 'health' && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                  <ShieldAlert className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Saúde da Conta (Benchmarks)</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {analysis.health_score.map((item, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight">{item.label}</h4>
                        <p className="text-xs text-slate-500 font-medium">Atual: {item.atual} | Meta: {item.meta}</p>
                      </div>
                      <div className={cn(
                        "text-sm font-black",
                        item.status === 'success' && "text-emerald-500",
                        item.status === 'warning' && "text-amber-500",
                        item.status === 'danger' && "text-red-500"
                      )}>
                        {item.porcentagem}%
                      </div>
                    </div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          item.status === 'success' && "bg-emerald-500",
                          item.status === 'warning' && "bg-amber-500",
                          item.status === 'danger' && "bg-red-500"
                        )}
                        style={{ width: `${item.porcentagem}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: Análise Estratégica */}
          {activeTab === 'analise' && (
            <div className="space-y-8">
              {/* 1. Resumo Executivo */}
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                    <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">1. Resumo Executivo</h3>
                </div>
                <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {analysis.resumo_executivo}
                </p>
              </div>

              {/* 2. Saúde das Métricas */}
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                    <Activity className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">2. Saúde das Métricas</h3>
                </div>
                <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                  {analysis.saude_metricas}
                </p>
              </div>

              {/* 3. Pontos Fortes */}
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
                    <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">3. Pontos Fortes</h3>
                </div>
                <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                  {analysis.pontos_fortes}
                </p>
              </div>

              {/* 4. Gargalos e Fugas de Verba */}
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-xl">
                    <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">4. Gargalos e Fugas de Verba</h3>
                </div>
                <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                  {analysis.gargalos_fugas}
                </p>
              </div>

              {/* 5. Plano de Ação Prático */}
              <div className="bg-indigo-600 p-8 rounded-3xl shadow-xl shadow-indigo-500/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">5. Plano de Ação Prático</h3>
                </div>
                <p className="text-lg text-white/90 leading-relaxed font-medium whitespace-pre-wrap mb-8">
                  {analysis.plano_acao_gerencial}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.plano_acao.map((plano, i) => (
                    <div key={i} className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-black text-white uppercase tracking-tight">{plano.titulo}</h4>
                        <div className="flex gap-1">
                          {plano.tags.map((tag, j) => (
                            <span key={j} className={cn(
                              "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest",
                              tag.type === 'danger' && "bg-red-500 text-white",
                              tag.type === 'success' && "bg-emerald-500 text-white",
                              tag.type === 'info' && "bg-blue-500 text-white"
                            )}>
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ul className="space-y-2">
                        {plano.acoes.map((acao, j) => (
                          <li key={j} className="flex items-center gap-2 text-xs text-indigo-100 font-medium">
                            <ArrowRight className="w-3 h-3 text-indigo-300" />
                            {acao}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Funil de Tráfego e Rankings */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Funil de Tráfego */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-pink-50 dark:bg-pink-900/30 rounded-xl">
                      <Filter className="w-5 h-5 text-pink-600" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Funil de Tráfego</h3>
                  </div>
                  
                  <div className="relative space-y-2">
                    {analysis.funil_trafego.map((item, i) => (
                      <div key={i} className="relative group">
                        <div 
                          className="h-16 flex items-center justify-between px-6 rounded-xl transition-all duration-500 hover:scale-[1.02]"
                          style={{ 
                            backgroundColor: `${item.cor}20`,
                            borderLeft: `4px solid ${item.cor}`,
                            width: `${100 - (i * 10)}%`,
                            marginLeft: `${i * 5}%`
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: item.cor }}>{item.etapa}</span>
                            <span className="text-lg font-black text-slate-900 dark:text-white">{item.valor.toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black opacity-60" style={{ color: item.cor }}>{item.porcentagem}%</span>
                          </div>
                        </div>
                        {i < analysis.funil_trafego.length - 1 && (
                          <div className="flex justify-center py-1">
                            <ChevronDown className="w-4 h-4 text-slate-300 animate-bounce" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ranking de Campanhas */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
                      <Award className="w-5 h-5 text-amber-600" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Ranking de Performance</h3>
                  </div>
                  
                  <div className="space-y-4">
                    {analysis.ranking_campanhas.map((camp, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm",
                          i === 0 ? "bg-amber-100 text-amber-600" : "bg-slate-200 text-slate-500"
                        )}>
                          {camp.posicao}º
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 dark:text-white truncate text-sm">{camp.nome}</h4>
                          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{camp.metrica_principal}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-indigo-600">{camp.valor}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Melhores Anúncios */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-xl">
                      <Flame className="w-5 h-5 text-orange-600" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Melhores Criativos</h3>
                  </div>
                  
                  <div className="space-y-4">
                    {analysis.melhores_anuncios.map((ad, i) => (
                      <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">{ad.titulo}</h4>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[8px] font-black rounded uppercase tracking-widest">
                            {ad.performance}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest">CTR</p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{ad.ctr}%</p>
                          </div>
                          <div>
                            <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest">Custo/Res</p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">R$ {ad.custo_resultado}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Diagnóstico por Campanha */}
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8 uppercase tracking-tight">Diagnóstico Detalhado</h3>
                <div className="space-y-4">
                  {analysis.diagnostico_detalhado.campanhas.map((camp, i) => (
                    <div key={i} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-3 h-3 rounded-full",
                            camp.status === 'ok' && "bg-emerald-500",
                            camp.status === 'warning' && "bg-amber-500",
                            camp.status === 'critical' && "bg-red-500"
                          )} />
                          <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{camp.nome}</h4>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                          <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(camp.investimento)}</span>
                          <span>{camp.resultados}</span>
                          <span className="px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            CTR: {camp.ctr.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                        {camp.veredicto}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Problemas e Soluções */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8 uppercase tracking-tight">Problemas Identificados</h3>
                  <div className="space-y-6">
                    {analysis.principais_problemas.map((prob, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 shrink-0">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight mb-1">{prob.titulo}</h4>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">{prob.descricao}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-indigo-600 p-8 rounded-3xl shadow-xl shadow-indigo-500/20">
                  <h3 className="text-xl font-black text-white mb-8 uppercase tracking-tight">Plano de Ação Estratégico</h3>
                  <div className="space-y-6">
                    {analysis.plano_acao.map((plano, i) => (
                      <div key={i} className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="font-black text-white uppercase tracking-tight">{plano.titulo}</h4>
                          <div className="flex gap-1">
                            {plano.tags.map((tag, j) => (
                              <span key={j} className={cn(
                                "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest",
                                tag.type === 'danger' && "bg-red-500 text-white",
                                tag.type === 'success' && "bg-emerald-500 text-white",
                                tag.type === 'info' && "bg-blue-500 text-white"
                              )}>
                                {tag.label}
                              </span>
                            ))}
                          </div>
                        </div>
                        <ul className="space-y-2">
                          {plano.acoes.map((acao, j) => (
                            <li key={j} className="flex items-center gap-2 text-xs text-indigo-100 font-medium">
                              <ArrowRight className="w-3 h-3 text-indigo-300" />
                              {acao}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!analysis && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <LayoutDashboard className="w-10 h-10 text-slate-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">Aguardando Análise</p>
            <p className="text-sm text-slate-500">Selecione um cliente e o período para gerar os insights inteligentes.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, subLabel, color }: { 
  icon: ReactNode; 
  label: string; 
  value: string; 
  subLabel: string;
  color: 'purple' | 'blue' | 'cyan' | 'yellow' | 'green' | 'orange' | 'indigo' | 'emerald' | 'red';
}) {
  const colors = {
    purple: "before:bg-purple-500",
    blue: "before:bg-blue-500",
    cyan: "before:bg-cyan-500",
    yellow: "before:bg-yellow-500",
    green: "before:bg-emerald-500",
    orange: "before:bg-orange-500",
    indigo: "before:bg-indigo-500",
    emerald: "before:bg-emerald-500",
    red: "before:bg-red-500"
  };

  return (
    <div className={cn(
      "relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 pt-6 overflow-hidden shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700",
      "before:absolute before:top-0 before:left-0 before:right-0 before:h-1",
      colors[color]
    )}>
      <div className="text-slate-400 mb-2">{icon}</div>
      <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-xl font-black text-slate-900 dark:text-white mb-1">{value}</div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{subLabel}</div>
    </div>
  );
}
