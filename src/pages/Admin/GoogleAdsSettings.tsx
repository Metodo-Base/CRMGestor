import { useEffect, useState } from "react";
import { collection, onSnapshot, query, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { GoogleAdsAccount } from "../../types";
import { Globe, Trash2, CheckCircle2, Plus, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export default function GoogleAdsSettings() {
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<GoogleAdsAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isWaitingForAccounts, setIsWaitingForAccounts] = useState(false);
  const [manualCustomerId, setManualCustomerId] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "google_ads_accounts"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as GoogleAdsAccount[];
      setAccounts(data);
      setLoading(false);
      
      if (data.length > 0) {
        setIsWaitingForAccounts(false);
      }
    }, (error) => {
      console.error("Erro ao carregar contas Google:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddManualAccount = async () => {
    if (!manualCustomerId) return;
    setActionLoading(true);
    try {
      const cleanId = manualCustomerId.replace(/-/g, "").trim();
      const accountData = {
        id: cleanId,
        name: `Conta ${manualCustomerId} (Manual)`,
        platform: 'google',
        is_test: true,
        updated_at: new Date().toISOString()
      };
      
      // Salva diretamente no Firestore
      await setDoc(doc(db, "google_ads_accounts", cleanId), accountData);
      setSuccess("Conta adicionada com sucesso!");
      setManualCustomerId("");
      setShowManualEntry(false);
    } catch (err: any) {
      setError("Erro ao adicionar conta: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    setSuccess(null);
    setIsWaitingForAccounts(false);
    try {
      const origin = window.location.origin;
      const response = await fetch(`/api/auth/google/url?cliente_id=centralized&origin=${encodeURIComponent(origin)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Erro desconhecido no servidor." }));
        throw new Error(errorData.error || `Erro do servidor: ${response.status}`);
      }

      const { url } = await response.json();
      if (!url) throw new Error("URL de autenticação não retornada pelo servidor.");
      
      console.log("[GoogleAds] URL de autenticação:", url);
      window.open(url, "google_auth", "width=600,height=700");
    } catch (error: any) {
      console.error("Erro ao conectar Google:", error);
      setError(error.message || "Erro ao iniciar conexão com Google Ads.");
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_AUTH_SUCCESS" && event.data.platform === "google") {
        setSuccess("Autenticação realizada! Aguardando o Google listar suas contas...");
        setIsWaitingForAccounts(true);
        
        // Timeout de 15 segundos para parar de mostrar a mensagem de espera se nada acontecer
        setTimeout(() => {
          setIsWaitingForAccounts(prev => {
            if (prev) {
              setSuccess(null);
              setError("O tempo de espera expirou. Se as contas não aparecerem, verifique seu Developer Token.");
              return false;
            }
            return false;
          });
        }, 15000);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleDeleteClick = (account: GoogleAdsAccount) => {
    setAccountToDelete(account);
    setError(null);
    setSuccess(null);
  };

  const confirmDelete = async () => {
    if (!accountToDelete) return;
    setActionLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "google_ads_accounts", accountToDelete.id));
      setAccountToDelete(null);
      setSuccess("Conta removida com sucesso.");
    } catch (err: any) {
      console.error("Erro ao remover conta:", err);
      setError(`Erro ao remover conta: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full">Carregando...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Contas Google Ads</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie as conexões centralizadas com o Google Ads</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {(error || success) && (
            <div className={cn(
              "px-4 py-2 border rounded-lg text-xs font-bold text-center",
              error ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400" : "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400"
            )}>
              {error || success}
            </div>
          )}
          <button
            onClick={() => setShowManualEntry(!showManualEntry)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg font-medium transition-all hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            {showManualEntry ? "Cancelar" : "Adicionar Manual"}
          </button>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-all shadow-sm disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            {connecting ? "Conectando..." : "Conectar Conta Google"}
          </button>
        </div>
      </div>

      {showManualEntry && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-indigo-200 dark:border-indigo-900/30 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Adicionar Conta Manualmente</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Se a busca automática falhar (comum em contas de teste), digite o ID da conta (ex: 123-456-7890).
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="000-000-0000"
              value={manualCustomerId}
              onChange={(e) => setManualCustomerId(e.target.value)}
              className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
            />
            <button
              onClick={handleAddManualAccount}
              disabled={actionLoading || !manualCustomerId}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
            >
              {actionLoading ? "Salvando..." : "Salvar Conta"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <Globe className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">Nenhuma conta Google Ads conectada ainda.</p>
            <button
              onClick={handleConnect}
              className="mt-4 text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
            >
              Clique aqui para conectar sua primeira conta
            </button>
          </div>
        ) : (
          accounts.map((account) => {
            return (
              <div key={account.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-lg border border-slate-100 dark:border-slate-700">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c3.11 0 5.72-1.03 7.63-2.79l-3.57-2.77c-1.01.68-2.31 1.08-4.06 1.08-3.12 0-5.77-2.11-6.72-4.94H2.01v2.84A11.99 11.99 0 0 0 12 23z"/>
                      <path fill="#FBBC05" d="M5.28 13.58a7.19 7.19 0 0 1 0-4.58V6.16H2.01a11.99 11.99 0 0 0 0 11.68l3.27-2.26z"/>
                      <path fill="#EA4335" d="M12 5.38c1.69 0 3.21.58 4.41 1.72l3.31-3.31C17.71 1.86 15.11 1 12 1 7.26 1 3.28 3.74 1.45 7.74l3.83 2.94c.95-2.83 3.6-4.94 6.72-4.94z"/>
                    </svg>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteClick(account)}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                      title="Remover conta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{account.name}</h3>
                    {account.is_test && (
                      <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 text-[10px] font-bold uppercase rounded">
                        Teste
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-500 font-mono">{account.id}</p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Conectado
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Atualizado: {new Date(account.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
                Remover Conta?
              </h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
                Tem certeza que deseja remover a conta <span className="font-bold text-slate-900 dark:text-white">{accountToDelete.name}</span>? 
                Clientes associados perderão o acesso aos dados.
              </p>
              
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-sm font-bold text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setAccountToDelete(null)}
                  className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Plus className="w-5 h-5 animate-spin" /> : 'Remover'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
