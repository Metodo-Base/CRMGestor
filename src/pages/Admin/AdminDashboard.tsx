import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { Cliente, DadosCampanha } from "../../types";
import { 
  TrendingUp, 
  Users, 
  Target, 
  DollarSign, 
  MousePointer2, 
  Eye, 
  BarChart3,
  Calendar,
  Filter,
  ChevronDown,
  X
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { cn } from "../../lib/utils";
import { useTheme } from "../../context/ThemeContext";
import { format, subDays, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminDashboard() {
  const { theme } = useTheme();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [dados, setDados] = useState<DadosCampanha[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedClienteId, setSelectedClienteId] = useState<string>("todos");
  const [periodo, setPeriodo] = useState("30");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    console.log("[AdminDashboard] Iniciando carregamento de dados consolidados...");
    const unsubClientes = onSnapshot(collection(db, "clientes"), (snapshot) => {
      const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Cliente[];
      console.log(`[AdminDashboard] ${clients.length} clientes carregados.`);
      setClientes(clients);
    });

    const unsubDados = onSnapshot(collection(db, "dados_campanhas"), (snapshot) => {
      const campaignData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DadosCampanha[];
      console.log(`[AdminDashboard] ${campaignData.length} registros de campanhas carregados do Firestore.`);
      setDados(campaignData);
      setLoading(false);
    });

    return () => {
      unsubClientes();
      unsubDados();
    };
  }, []);

  // Aggregated Metrics
  const fakeNames = [
    "exemplo", "teste", "mock", "fake", "ficticia", "fictícia", 
    "silva advogados", "clínica sorriso", "techworld", "imobiliária horizonte",
    "cliente 1", "cliente 2", "cliente 3", "cliente 4", "cliente 5",
    "empresa a", "empresa b", "empresa c", "dashboard exemplo",
    "demo", "amostra", "modelo", "padrão", "padrao"
  ];
  
  const isFake = (name: string) => {
    if (!name || name.trim() === "") return true;
    const nameLower = name.toLowerCase();
    const isGeneric = /^(cliente|empresa|teste|exemplo)\s*\d*$/i.test(nameLower);
    return isGeneric || fakeNames.some(fake => nameLower.includes(fake));
  };

  const realClientes = useMemo(() => 
    clientes.filter(c => c.meta_ads_conectado && !isFake(c.nome_cliente)),
  [clientes]);

  const realClientIds = useMemo(() => realClientes.map(c => c.id), [realClientes]);
  
  const filteredDados = useMemo(() => {
    let filtered = dados.filter(d => realClientIds.includes(d.cliente_id) && d.plataforma === 'meta_ads');

    // Filter by Client
    if (selectedClienteId !== "todos") {
      filtered = filtered.filter(d => d.cliente_id === selectedClienteId);
    }

    // Filter by Period
    const now = new Date();
    let start = startOfDay(subDays(now, parseInt(periodo)));
    let end = endOfDay(now);

    if (periodo === "custom" && dataInicio && dataFim) {
      start = startOfDay(parseISO(dataInicio));
      end = endOfDay(parseISO(dataFim));
    } else if (periodo === "max") {
      return filtered;
    }

    return filtered.filter(d => {
      const itemDate = parseISO(d.data);
      return isWithinInterval(itemDate, { start, end });
    });
  }, [dados, realClientIds, selectedClienteId, periodo, dataInicio, dataFim]);
  
  const totalInvestido = filteredDados.reduce((acc, curr) => acc + curr.investimento, 0);
  const totalCliques = filteredDados.reduce((acc, curr) => acc + curr.cliques, 0);
  const totalImpressoes = filteredDados.reduce((acc, curr) => acc + curr.impressoes, 0);
  const totalConversoes = filteredDados.reduce((acc, curr) => acc + curr.conversoes, 0);
  const avgCTR = totalImpressoes > 0 ? (totalCliques / totalImpressoes) * 100 : 0;

  // Chart Data: Daily Spend
  const dailyData = filteredDados.reduce((acc: any[], curr) => {
    const date = curr.data;
    const existing = acc.find(item => item.date === date);
    if (existing) {
      existing.investimento += curr.investimento;
      existing.cliques += curr.cliques;
    } else {
      acc.push({ date, investimento: curr.investimento, cliques: curr.cliques });
    }
    return acc;
  }, []).sort((a, b) => a.date.localeCompare(b.date));

  // Client Performance Data
  const clientPerformance = realClientes
    .map(cliente => {
      const clientData = filteredDados.filter(d => d.cliente_id === cliente.id);
      const investido = clientData.reduce((acc, curr) => acc + curr.investimento, 0);
      return {
        name: cliente.nome_cliente,
        investido
      };
    })
    .filter(c => c.investido > 0 || selectedClienteId === "todos")
    .sort((a, b) => b.investido - a.investido);

  const stats = [
    { name: "Investimento Total", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInvestido), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
    { name: "Cliques Totais", value: totalCliques.toLocaleString("pt-BR"), icon: MousePointer2, color: "text-blue-600", bg: "bg-blue-50" },
    { name: "CTR Médio", value: `${avgCTR.toFixed(2)}%`, icon: Target, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  if (loading) return <div className="flex items-center justify-center h-full">Carregando Dashboard...</div>;

  return (
    <div className="space-y-6 lg:space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Dashboard Geral</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Visão consolidada de performance de todos os clientes.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-bold uppercase tracking-wider",
              showFilters 
                ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-500"
            )}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {showFilters ? <X className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-slate-900 p-4 lg:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cliente</label>
              <select 
                value={selectedClienteId}
                onChange={(e) => setSelectedClienteId(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 transition-all"
              >
                <option value="todos">Todos os Clientes</option>
                {realClientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome_cliente}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Período</label>
              <select 
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 transition-all"
              >
                <option value="7">Últimos 7 dias</option>
                <option value="15">Últimos 15 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
                <option value="max">Todo o período</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>

            {periodo === "custom" && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Início</label>
                  <input 
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Fim</label>
                  <input 
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {filteredDados.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 lg:p-20 text-center space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="p-3 lg:p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
            <BarChart3 className="w-6 h-6 lg:w-8 lg:h-8 text-indigo-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base lg:text-lg font-bold text-slate-900 dark:text-white">Nenhum dado encontrado</h3>
            <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 max-w-xs lg:max-w-md mx-auto">
              Não há dados para os filtros selecionados. Tente ajustar o período ou o cliente.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
            {stats.map((stat) => (
              <div key={stat.name} className="bg-white dark:bg-slate-900 p-4 lg:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
                <div className="flex items-center justify-between mb-2 lg:mb-4">
                  <div className={cn("p-1.5 lg:p-2 rounded-lg", stat.bg, "dark:bg-slate-800")}>
                    <stat.icon className={cn("w-4 h-4 lg:w-6 lg:h-6", stat.color, "dark:text-indigo-400")} />
                  </div>
                </div>
                <p className="text-[10px] lg:text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider lg:normal-case lg:tracking-normal">{stat.name}</p>
                <p className="text-lg lg:text-2xl font-bold text-slate-900 dark:text-white mt-0.5 lg:mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Main Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 lg:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
              <div className="flex items-center justify-between mb-6 lg:mb-8">
                <h3 className="text-sm lg:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 lg:w-5 lg:h-5 text-indigo-500 dark:text-indigo-400" />
                  Investimento Diário {selectedClienteId !== "todos" ? ` - ${realClientes.find(c => c.id === selectedClienteId)?.nome_cliente}` : "Consolidado"}
                </h3>
              </div>
              <div className="h-[250px] lg:h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="colorInvest" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickFormatter={(val) => {
                        const date = new Date(val);
                        return window.innerWidth < 768 
                          ? date.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })
                          : date.toLocaleDateString("pt-BR", { day: '2-digit', month: 'short' });
                      }}
                      minTickGap={20}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10 }} 
                      tickFormatter={(val) => {
                        if (val >= 1000) return `R$ ${(val/1000).toFixed(1)}k`;
                        return `R$ ${val}`;
                      }}
                      width={45}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', 
                        borderColor: theme === 'dark' ? '#1e293b' : '#e2e8f0',
                        borderRadius: '12px', 
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontSize: '12px'
                      }}
                      itemStyle={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}
                      labelStyle={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 'bold' }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString("pt-BR", { day: '2-digit', month: 'long' })}
                      formatter={(value: any) => [new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value), "Investimento"]}
                    />
                    <Area type="monotone" dataKey="investimento" name="Investimento (R$)" stroke="#6366f1" strokeWidth={window.innerWidth < 768 ? 2 : 3} fillOpacity={1} fill="url(#colorInvest)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Client Performance List */}
            <div className="bg-white dark:bg-slate-900 p-4 lg:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
              <h3 className="text-sm lg:text-base font-bold text-slate-900 dark:text-white mb-6">
                {selectedClienteId === "todos" ? "Top Clientes por Investimento" : "Performance do Cliente"}
              </h3>
              <div className="space-y-4 lg:space-y-6">
                {clientPerformance.slice(0, 8).map((client, idx) => (
                  <div key={client.name} className="flex items-center justify-between p-2 lg:p-0 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] lg:text-xs font-bold text-slate-500 dark:text-slate-400">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-xs lg:text-sm font-bold text-slate-900 dark:text-white truncate max-w-[120px] lg:max-w-none">{client.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs lg:text-sm font-bold text-slate-900 dark:text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(client.investido)}</p>
                      <div className="w-16 lg:w-24 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full" 
                          style={{ width: `${clientPerformance[0].investido > 0 ? (client.investido / clientPerformance[0].investido) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
