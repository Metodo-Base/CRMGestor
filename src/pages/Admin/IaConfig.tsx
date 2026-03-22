import { useState, useEffect } from "react";
import * as React from "react";
import { collection, onSnapshot, query, setDoc, doc, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { Brain, Save, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export default function IaConfig() {
  const [config, setConfig] = useState<any>({
    provedor: "google_gemini",
    modelo: "gemini-1.5-flash",
    api_key_ia: "",
    limite_tokens: 2000,
    modo_resposta_padrao: "enxuto"
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      const snap = await getDocs(collection(db, "config_ia"));
      if (!snap.empty) {
        setConfig(snap.docs[0].data());
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      // In a real app, we'd use a single document ID for config
      await setDoc(doc(db, "config_ia", "default"), {
        ...config,
        updated_at: new Date().toISOString()
      });
      setSuccess("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar config IA:", error);
      setError("Erro ao salvar configurações. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações de IA</h2>
        <p className="text-slate-500 dark:text-slate-400">Configure o provedor e o modelo de IA para a busca inteligente.</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="hover:text-red-800 dark:hover:text-red-300">×</button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="hover:text-emerald-800 dark:hover:text-emerald-300">×</button>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-8 transition-colors duration-300">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Provedor de IA</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setConfig({ ...config, provedor: "google_gemini", modelo: "gemini-1.5-flash" })}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                  config.provedor === "google_gemini" 
                    ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/20" 
                    : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c3.11 0 5.72-1.03 7.63-2.79l-3.57-2.77c-1.01.68-2.31 1.08-4.06 1.08-3.12 0-5.77-2.11-6.72-4.94H2.01v2.84A11.99 11.99 0 0 0 12 23z"/>
                    <path fill="#FBBC05" d="M5.28 13.58a7.19 7.19 0 0 1 0-4.58V6.16H2.01a11.99 11.99 0 0 0 0 11.68l3.27-2.26z"/>
                    <path fill="#EA4335" d="M12 5.38c1.69 0 3.21.58 4.41 1.72l3.31-3.31C17.71 1.86 15.11 1 12 1 7.26 1 3.28 3.74 1.45 7.74l3.83 2.94c.95-2.83 3.6-4.94 6.72-4.94z"/>
                  </svg>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">Google Gemini</span>
              </button>
              <button
                type="button"
                onClick={() => setConfig({ ...config, provedor: "openai", modelo: "gpt-4" })}
                className={cn(
                  "flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                  config.provedor === "openai" 
                    ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/20" 
                    : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                  <Brain className="w-6 h-6 text-emerald-500" />
                </div>
                <span className="font-bold text-slate-900 dark:text-white">OpenAI</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Modelo</label>
            <input
              type="text"
              className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={config.modelo}
              onChange={(e) => setConfig({ ...config, modelo: e.target.value })}
              placeholder={config.provedor === "google_gemini" ? "gemini-1.5-flash" : "gpt-4"}
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Chave da API</label>
            <input
              type="password"
              className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={config.api_key_ia}
              onChange={(e) => setConfig({ ...config, api_key_ia: e.target.value })}
              placeholder="sk-..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Limite de Tokens</label>
            <input
              type="number"
              className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={config.limite_tokens}
              onChange={(e) => setConfig({ ...config, limite_tokens: parseInt(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Modo de Resposta Padrão</label>
            <select
              className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={config.modo_resposta_padrao}
              onChange={(e) => setConfig({ ...config, modo_resposta_padrao: e.target.value })}
            >
              <option value="enxuto">Enxuto</option>
              <option value="detalhado">Detalhado</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 text-white px-8 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </form>
    </div>
  );
}
