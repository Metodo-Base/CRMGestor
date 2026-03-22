import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { MetaAdsAccount } from "../../types";
import { Facebook, Trash2, AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { cn } from "../../lib/utils";

export default function MetaAdsSettings() {
  const [accounts, setAccounts] = useState<MetaAdsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<MetaAdsAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "meta_ads_accounts"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MetaAdsAccount[];
      setAccounts(data);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar contas Meta:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const origin = window.location.origin;
      const response = await fetch(`/api/auth/meta/url?cliente_id=centralized&origin=${encodeURIComponent(origin)}`);
      const { url } = await response.json();
      window.open(url, "meta_auth", "width=600,height=700");
      setError(null);
      setSuccess(null);
    } catch (error: any) {
      console.error("Erro ao conectar Meta:", error);
      setError("Erro ao iniciar conexão com Meta Ads.");
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_AUTH_SUCCESS" && event.data.platform === "meta") {
        const { accessToken, expiresIn, adAccounts } = event.data;
        const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : "";
        
        // Save each ad account to the centralized collection
        const promises = adAccounts.map((acc: { account_id: string; name: string }) => {
          return setDoc(doc(db, "meta_ads_accounts", acc.account_id), {
            name: acc.name,
            access_token: accessToken,
            status: "connected",
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
          });
        });

        await Promise.all(promises);
        setSuccess(`${adAccounts.length} contas de anúncios conectadas com sucesso!`);
        setError(null);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleDeleteClick = (account: MetaAdsAccount) => {
    setAccountToDelete(account);
    setError(null);
    setSuccess(null);
  };

  const confirmDelete = async () => {
    if (!accountToDelete) return;
    setActionLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "meta_ads_accounts", accountToDelete.id));
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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Contas Meta Ads</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie as conexões centralizadas com a Meta Ads</p>
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
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-sm disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            {connecting ? "Conectando..." : "Conectar Conta Meta"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <Facebook className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">Nenhuma conta Meta Ads conectada ainda.</p>
            <button
              onClick={handleConnect}
              className="mt-4 text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
            >
              Clique aqui para conectar sua primeira conta
            </button>
          </div>
        ) : (
          accounts.map((account) => {
            const isExpired = new Date(account.expires_at) < new Date();
            return (
              <div key={account.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg">
                    <Facebook className="w-5 h-5" />
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
                  <h3 className="font-bold text-slate-900 dark:text-white truncate">{account.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-500 font-mono">{account.id}</p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    {isExpired ? (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                    <span className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      isExpired ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                    )}>
                      {isExpired ? "Expirado" : "Conectado"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Expira: {new Date(account.expires_at).toLocaleDateString("pt-BR")}
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
