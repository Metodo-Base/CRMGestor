import { FileText, Terminal, Key, Database, Search } from "lucide-react";
import { cn } from "../../lib/utils";

export default function ApiDocs() {
  const endpoints = [
    {
      method: "GET",
      path: "/api/v1/clientes",
      description: "Lista todos os clientes ativos.",
      params: [
        { name: "page", type: "number", description: "Página atual (default: 1)" },
        { name: "limit", type: "number", description: "Itens por página (default: 10)" },
      ]
    },
    {
      method: "GET",
      path: "/api/v1/clientes/:id/campanhas",
      description: "Lista campanhas de um cliente específico.",
      params: [
        { name: "plataforma", type: "string", description: "Filtrar por 'meta' ou 'google'" },
        { name: "status", type: "string", description: "Filtrar por 'ativa', 'pausada', etc." },
      ]
    },
    {
      method: "POST",
      path: "/api/v1/busca-ia",
      description: "Realiza busca inteligente nos dados de campanha.",
      body: [
        { name: "query", type: "string", required: true, description: "Texto livre para busca" },
        { name: "cliente_id", type: "string", required: false, description: "ID do cliente (opcional)" },
        { name: "modo", type: "string", required: false, description: "'enxuto' ou 'detalhado'" },
      ]
    }
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Documentação da API</h2>
        <p className="text-slate-500 dark:text-slate-400">Guia de integração com a API privada do sistema.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 transition-colors duration-300">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
            <Key className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white">Autenticação</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Todas as requisições devem incluir o header <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Authorization</code> com o formato <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Bearer YOUR_API_KEY</code>.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 transition-colors duration-300">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white">Formato de Dados</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            A API utiliza JSON para entrada e saída de dados. Datas seguem o padrão ISO 8601 (YYYY-MM-DDTHH:MM:SSZ).
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 transition-colors duration-300">
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
            <Terminal className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white">Base URL</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-mono bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
            {window.location.origin}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
          Endpoints v1
        </h3>
        
        <div className="space-y-4">
          {endpoints.map((ep, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4">
                <span className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold uppercase",
                  ep.method === "GET" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                )}>
                  {ep.method}
                </span>
                <code className="text-sm font-bold text-slate-700 dark:text-slate-300">{ep.path}</code>
                <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">{ep.description}</span>
              </div>
              <div className="p-6 space-y-4">
                {ep.params && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Query Parameters</p>
                    <div className="grid grid-cols-1 gap-2">
                      {ep.params.map((p, pIdx) => (
                        <div key={pIdx} className="flex items-center gap-4 text-sm">
                          <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-bold">{p.name}</code>
                          <span className="text-slate-400 dark:text-slate-500 italic">{p.type}</span>
                          <span className="text-slate-600 dark:text-slate-300">{p.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {ep.body && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Request Body (JSON)</p>
                    <div className="grid grid-cols-1 gap-2">
                      {ep.body.map((b, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-4 text-sm">
                          <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-bold">{b.name}</code>
                          <span className="text-slate-400 dark:text-slate-500 italic">{b.type}</span>
                          {b.required && <span className="text-rose-500 text-[10px] font-bold uppercase">Required</span>}
                          <span className="text-slate-600 dark:text-slate-300">{b.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
