import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase";
import { History, Search, Filter, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export default function IaLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, "logs_busca_ia"), orderBy("data_hora", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Logs da Busca IA</h2>
        <p className="text-slate-500 dark:text-slate-400">Acompanhe o histórico de buscas realizadas pela inteligência artificial.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Filtrar por query..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <button className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Filter className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>

          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Data/Hora</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Query</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr 
                    key={log.id} 
                    className={cn(
                      "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer",
                      selectedLog?.id === log.id && "bg-indigo-50/50 dark:bg-indigo-900/20"
                    )}
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {new Date(log.data_hora).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100 max-w-xs truncate">
                      {log.query_original}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold",
                        log.status === "sucesso" 
                          ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" 
                          : "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                      )}>
                        {log.status === "sucesso" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
            {logs.map((log) => (
              <div 
                key={log.id} 
                className={cn(
                  "p-4 space-y-3 cursor-pointer",
                  selectedLog?.id === log.id && "bg-indigo-50/50 dark:bg-indigo-900/20"
                )}
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(log.data_hora).toLocaleString("pt-BR")}
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    log.status === "sucesso" 
                      ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" 
                      : "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                  )}>
                    {log.status === "sucesso" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {log.status}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {log.query_original}
                  </p>
                  <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6 transition-colors duration-300">
          <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4">Detalhes do Log</h3>
          {selectedLog ? (
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Query Original</p>
                <p className="text-sm text-slate-900 dark:text-slate-100 italic">"{selectedLog.query_original}"</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Provedor</p>
                  <p className="text-sm text-slate-900 dark:text-slate-300">{selectedLog.provedor}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Modelo</p>
                  <p className="text-sm text-slate-900 dark:text-slate-300">{selectedLog.modelo}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tempo Resposta</p>
                  <p className="text-sm text-slate-900 dark:text-slate-300">{selectedLog.tempo_resposta_ms}ms</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Resultados</p>
                  <p className="text-sm text-slate-900 dark:text-slate-300">{selectedLog.quantidade_resultados}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Filtros Interpretados</p>
                <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg text-xs font-mono overflow-auto max-h-40 text-slate-700 dark:text-slate-300">
                  {JSON.stringify(selectedLog.filtros_interpretados, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600 space-y-2">
              <History className="w-12 h-12 opacity-20" />
              <p className="text-sm">Selecione um log para ver os detalhes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
