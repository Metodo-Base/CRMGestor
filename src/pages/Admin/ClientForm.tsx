import { useEffect, useState } from "react";
import * as React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc, setDoc, collection, onSnapshot, query, orderBy, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Cliente, DadosCampanha, MetaAdsAccount, GoogleAdsAccount } from "../../types";
import { ArrowLeft, Save, RefreshCw, ExternalLink, Facebook, Globe, MessageCircle, Mail, Building2, Image as ImageIcon, Plus } from "lucide-react";
import { cn } from "../../lib/utils";

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  // Generate a stable ID for new clients to allow OAuth connection before saving
  const [clientId] = useState(id || crypto.randomUUID());

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showMetaRedirectModal, setShowMetaRedirectModal] = useState(false);
  const [showGoogleRedirectModal, setShowGoogleRedirectModal] = useState(false);
  const [showSyncInfoModal, setShowSyncInfoModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const [formData, setFormData] = useState<Partial<Cliente>>({
    nome_cliente: "",
    segmento: "",
    logo_url: "",
    email_contato: "",
    whatsapp_contato: "",
    meta_ads_conectado: false,
    meta_ads_account_id: "",
    google_ads_conectado: false,
    google_ads_customer_id: "",
    dashboard_url: "",
  });

  const [metaAccounts, setMetaAccounts] = useState<MetaAdsAccount[]>([]);
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAdsAccount[]>([]);

  useEffect(() => {
    const q = query(collection(db, "meta_ads_accounts"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MetaAdsAccount[];
      setMetaAccounts(data);
    }, (error) => {
      console.error("Erro ao carregar contas Meta no formulário:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "google_ads_accounts"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as GoogleAdsAccount[];
      setGoogleAccounts(data);
    }, (error) => {
      console.error("Erro ao carregar contas Google no formulário:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleConnectMeta = async () => {
    setShowMetaRedirectModal(true);
  };

  const confirmMetaRedirect = () => {
    setShowMetaRedirectModal(false);
    navigate("/admin/meta-accounts");
  };

  const handleConnectGoogle = async () => {
    setShowGoogleRedirectModal(true);
  };

  const confirmGoogleRedirect = () => {
    setShowGoogleRedirectModal(false);
    navigate("/admin/google-accounts");
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        if (event.data.platform === "meta") {
          // This should not happen anymore in ClientForm, but keeping for safety
          setSuccess("Conta Meta conectada! Por favor, selecione-a na lista abaixo.");
        } else {
          setFormData(prev => ({
            ...prev,
            google_ads_conectado: true
          }));
          setSuccess("Google Ads conectado com sucesso!");
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (isEditing) {
      const fetchCliente = async () => {
        try {
          const docRef = doc(db, "clientes", id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setFormData(docSnap.data() as Cliente);
          } else {
            console.error("Cliente não encontrado");
            navigate("/admin");
          }
        } catch (error) {
          console.error("Erro ao carregar cliente:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchCliente();
    }
  }, [id, isEditing, navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const clientData = {
        ...formData,
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        await updateDoc(doc(db, "clientes", clientId), clientData);
      } else {
        const finalData = {
          ...clientData,
          id: clientId,
          created_at: new Date().toISOString(),
          dashboard_url: `${window.location.origin}/dashboard/${clientId}`,
        };
        await setDoc(doc(db, "clientes", clientId), finalData, { merge: true });
      }
      navigate("/admin");
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!id) return;
    setShowSyncInfoModal(true);
  };

  if (loading) return <div className="flex items-center justify-center h-full">Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <Link to="/admin" className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
          Voltar para listagem
        </Link>
        <div className="flex items-center gap-3">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="hover:text-red-800 dark:hover:text-red-300">×</button>
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <span>{success}</span>
              <button onClick={() => setSuccess(null)} className="hover:text-emerald-800 dark:hover:text-emerald-300">×</button>
            </div>
          )}
          {isEditing && (
            <>
              <a
                href={`/dashboard/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Visualizar Dashboard
              </a>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-all disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                {syncing ? "Sincronizando..." : "Sincronizar Dados Agora"}
              </button>
            </>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Identidade do Cliente */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              Identidade do Cliente
            </h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome do Cliente *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={formData.nome_cliente}
                onChange={(e) => setFormData({ ...formData, nome_cliente: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Segmento de Atuação</label>
              <input
                type="text"
                className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={formData.segmento}
                onChange={(e) => setFormData({ ...formData, segmento: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">URL da Logo (opcional)</label>
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="url"
                    placeholder="https://exemplo.com/logo.png"
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  />
                </div>
                {formData.logo_url && (
                  <div className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-800">
                    <img src={formData.logo_url} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Contato e Acesso */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              Contato e Acesso
            </h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">E-mail de Contato *</label>
              <input
                type="email"
                required
                className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={formData.email_contato}
                onChange={(e) => setFormData({ ...formData, email_contato: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                WhatsApp de Contato
              </label>
              <input
                type="text"
                placeholder="(00) 00000-0000"
                className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={formData.whatsapp_contato}
                onChange={(e) => setFormData({ ...formData, whatsapp_contato: e.target.value })}
              />
            </div>
            {isEditing && (
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Link de Acesso ao Dashboard</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-not-allowed"
                    value={formData.dashboard_url}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(formData.dashboard_url || "");
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }}
                    className="px-4 py-2 text-indigo-600 dark:text-indigo-400 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all relative"
                  >
                    {copySuccess ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Integrações de Anúncios */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              Integrações de Anúncios
            </h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={cn(
              "p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-4 text-center",
              formData.meta_ads_conectado 
                ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/20" 
                : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
            )}>
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg">
                <Facebook className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">Meta Ads</h4>
                <div className="flex flex-col items-center gap-1 mt-1">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    formData.meta_ads_conectado 
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  )}>
                    {formData.meta_ads_conectado ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>

              <div className="w-full space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Vincular Conta de Anúncios</label>
                  <select
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20"
                    value={formData.meta_ads_account_id}
                    onChange={(e) => {
                      const accountId = e.target.value;
                      setFormData({ 
                        ...formData, 
                        meta_ads_account_id: accountId,
                        meta_ads_conectado: !!accountId
                      });
                    }}
                  >
                    <option value="">Nenhuma conta selecionada</option>
                    {metaAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.id})
                      </option>
                    ))}
                  </select>
                  {metaAccounts.length === 0 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      Nenhuma conta conectada. Vá em "Contas Meta Ads" para conectar.
                    </p>
                  )}
                </div>
              </div>

              {!formData.meta_ads_conectado && (
                <button
                  type="button"
                  onClick={handleConnectMeta}
                  className="w-full py-2 rounded-lg font-medium transition-all bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Conectar Nova Conta
                </button>
              )}
            </div>

            <div className={cn(
              "p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-4 text-center",
              formData.google_ads_conectado 
                ? "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/20" 
                : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
            )}>
              <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-lg border border-slate-100 dark:border-slate-700">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c3.11 0 5.72-1.03 7.63-2.79l-3.57-2.77c-1.01.68-2.31 1.08-4.06 1.08-3.12 0-5.77-2.11-6.72-4.94H2.01v2.84A11.99 11.99 0 0 0 12 23z"/>
                  <path fill="#FBBC05" d="M5.28 13.58a7.19 7.19 0 0 1 0-4.58V6.16H2.01a11.99 11.99 0 0 0 0 11.68l3.27-2.26z"/>
                  <path fill="#EA4335" d="M12 5.38c1.69 0 3.21.58 4.41 1.72l3.31-3.31C17.71 1.86 15.11 1 12 1 7.26 1 3.28 3.74 1.45 7.74l3.83 2.94c.95-2.83 3.6-4.94 6.72-4.94z"/>
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">Google Ads</h4>
                <div className="flex flex-col items-center gap-1 mt-1">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    formData.google_ads_conectado 
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  )}>
                    {formData.google_ads_conectado ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>

              <div className="w-full space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Vincular Conta de Anúncios</label>
                  <select
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20"
                    value={formData.google_ads_customer_id}
                    onChange={(e) => {
                      const customerId = e.target.value;
                      setFormData({ 
                        ...formData, 
                        google_ads_customer_id: customerId,
                        google_ads_conectado: !!customerId
                      });
                    }}
                  >
                    <option value="">Nenhuma conta selecionada</option>
                    {googleAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.id})
                      </option>
                    ))}
                  </select>
                  {googleAccounts.length === 0 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      Nenhuma conta conectada. Vá em "Contas Google Ads" para conectar.
                    </p>
                  )}
                </div>
              </div>

              {!formData.google_ads_conectado && (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  className="w-full py-2 rounded-lg font-medium transition-all bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Conectar Nova Conta
                </button>
              )}
            </div>
          </div>
        </section>
      </form>

      {/* Modal de Redirecionamento Meta */}
      {showMetaRedirectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Gestão Centralizada</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              A gestão de contas Meta agora é centralizada para facilitar o reuso entre clientes. Deseja ir para a página de configurações de contas?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowMetaRedirectModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmMetaRedirect}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                Ir para Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Redirecionamento Google */}
      {showGoogleRedirectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Gestão Centralizada</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              A gestão de contas Google Ads agora é centralizada para facilitar o reuso entre clientes. Deseja ir para a página de configurações de contas?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowGoogleRedirectModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmGoogleRedirect}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                Ir para Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Informação de Sincronização */}
      {showSyncInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sincronização de Dados</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Os dados reais são buscados diretamente da API da Meta em tempo real quando você visualiza o Dashboard do cliente. Não é necessário sincronizar manualmente aqui.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowSyncInfoModal(false)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
