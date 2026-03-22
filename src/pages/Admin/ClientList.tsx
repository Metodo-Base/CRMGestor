import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { Cliente } from "../../types";
import { Plus, Edit2, Search, CheckCircle2, XCircle, BarChart3, AlertCircle, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";

export default function ClientList() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientToDelete, setClientToDelete] = useState<Cliente | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "clientes"), orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Cliente[];
      setClientes(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching clients:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteClick = (cliente: Cliente) => {
    setClientToDelete(cliente);
    setError(null);
  };

  const confirmDelete = async () => {
    if (!clientToDelete) return;
    setActionLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "clientes", clientToDelete.id));
      setClientToDelete(null);
    } catch (err: any) {
      console.error("Erro ao excluir cliente:", err);
      setError(`Erro ao excluir cliente: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const fakeNames = ["exemplo", "teste", "mock", "fake", "ficticia", "fictícia", "silva advogados", "clínica sorriso", "techworld", "imobiliária horizonte"];
  const isFake = (name: string) => {
    if (!name || name.trim() === "") return true;
    return fakeNames.some(fake => name.toLowerCase().includes(fake));
  };

  const filteredClientes = clientes.filter((c) => {
    const matchesSearch = c.nome_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.segmento?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Only show real clients (connected to Meta Ads and not fake names)
    // Actually, the user wants them GONE from the screen.
    const isReal = c.meta_ads_conectado && 
                   !isFake(c.nome_cliente) &&
                   !( (!c.nome_cliente || c.nome_cliente.trim() === "") && c.ultima_sincronizacao?.includes("2026-03-17T19:15:18") );
    
    return matchesSearch && isReal;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="px-1">
          <h2 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Gerenciamento de Clientes</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Visualize e gerencie todos os seus clientes e suas conexões.</p>
        </div>
        <div className="flex items-center gap-3">
          {error && !clientToDelete && (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg text-red-600 dark:text-red-400 text-xs font-bold">
              {error}
            </div>
          )}
          <Link
            to="/admin/novo"
            className="w-full lg:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-500/20 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm">Adicionar Novo Cliente</span>
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou segmento..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="block lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              Carregando clientes...
            </div>
          ) : filteredClientes.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              Nenhum cliente encontrado.
            </div>
          ) : (
            filteredClientes.map((cliente) => (
              <div key={cliente.id} className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {cliente.logo_url ? (
                      <img
                        src={cliente.logo_url}
                        alt={cliente.nome_cliente}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-lg">
                        {cliente.nome_cliente.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">{cliente.nome_cliente}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{cliente.email_contato}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 rounded-md uppercase tracking-wider">
                        {cliente.segmento || "Sem Segmento"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Link
                      to={`/admin/editar/${cliente.id}`}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                    >
                      <Edit2 className="w-5 h-5" />
                    </Link>
                    <button
                      onClick={() => handleDeleteClick(cliente)}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Conexões</span>
                      <div className="flex gap-2 mt-1">
                        <div className="relative" title="Meta Ads">
                          {cliente.meta_ads_conectado ? (
                            cliente.meta_ads_expires_at && new Date(cliente.meta_ads_expires_at) < new Date() ? (
                              <AlertCircle className="w-5 h-5 text-amber-500" />
                            ) : (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            )
                          ) : (
                            <XCircle className="w-5 h-5 text-slate-300 dark:text-slate-700" />
                          )}
                          <span className="absolute -top-1 -right-1 text-[6px] font-black bg-white dark:bg-slate-900 px-0.5 rounded border border-slate-200 dark:border-slate-700">M</span>
                        </div>
                        <div className="relative" title="Google Ads">
                          {cliente.google_ads_conectado ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-slate-300 dark:text-slate-700" />
                          )}
                          <span className="absolute -top-1 -right-1 text-[6px] font-black bg-white dark:bg-slate-900 px-0.5 rounded border border-slate-200 dark:border-slate-700">G</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Sincronização</span>
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                      {cliente.ultima_sincronizacao
                        ? new Date(cliente.ultima_sincronizacao).toLocaleDateString("pt-BR")
                        : "Nunca"}
                    </p>
                  </div>
                </div>

                <Link
                  to={`/admin/dashboard/${cliente.id}`}
                  className="w-full py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all border border-indigo-100/50 dark:border-indigo-900/30"
                >
                  <BarChart3 className="w-4 h-4" />
                  Ver Dashboard Detalhado
                </Link>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Segmento</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Conexões</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sincronização</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    Carregando clientes...
                  </td>
                </tr>
              ) : filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                filteredClientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {cliente.logo_url ? (
                          <img
                            src={cliente.logo_url}
                            alt={cliente.nome_cliente}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold">
                            {cliente.nome_cliente.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{cliente.nome_cliente}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{cliente.email_contato}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 dark:text-slate-400">{cliente.segmento || "—"}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-4">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Meta</span>
                          {cliente.meta_ads_conectado ? (
                            cliente.meta_ads_expires_at && new Date(cliente.meta_ads_expires_at) < new Date() ? (
                              <div className="flex flex-col items-center">
                                <AlertCircle className="w-5 h-5 text-amber-500" title="Token Expirado" />
                                <span className="text-[8px] text-amber-500 font-bold">EXPIRADO</span>
                              </div>
                            ) : (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" title="Conectado" />
                            )
                          ) : (
                            <XCircle className="w-5 h-5 text-slate-300 dark:text-slate-700" title="Desconectado" />
                          )}
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Google</span>
                          {cliente.google_ads_conectado ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-slate-300 dark:text-slate-700" />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {cliente.ultima_sincronizacao
                          ? new Date(cliente.ultima_sincronizacao).toLocaleString("pt-BR")
                          : "Nunca"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/editar/${cliente.id}`}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                          title="Editar Cliente"
                        >
                          <Edit2 className="w-5 h-5" />
                        </Link>
                        <Link
                          to={`/admin/dashboard/${cliente.id}`}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all"
                          title="Ver Dashboard Detalhado"
                        >
                          <BarChart3 className="w-5 h-5" />
                        </Link>
                        <button
                          onClick={() => handleDeleteClick(cliente)}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                          title="Excluir Cliente"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
                Excluir Cliente?
              </h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
                Tem certeza que deseja excluir o cliente <span className="font-bold text-slate-900 dark:text-white">{clientToDelete.nome_cliente}</span>? 
                Esta ação não pode ser desfeita.
              </p>
              
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-sm font-bold text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setClientToDelete(null)}
                  className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Plus className="w-5 h-5 animate-spin" /> : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
