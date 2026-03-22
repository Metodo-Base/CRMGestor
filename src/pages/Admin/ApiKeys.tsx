import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { Key, Plus, Trash2, Copy, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export default function ApiKeys() {
  const [keys, setKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "api_keys"), orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setKeys(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleGenerateKey = async () => {
    if (!newKeyName) return;
    const rawKey = `sk_${crypto.randomUUID().replace(/-/g, '')}`;
    // In a real app, we'd hash this before storing
    await addDoc(collection(db, "api_keys"), {
      nome: newKeyName,
      key_hash: rawKey, // Placeholder for hash
      status: "ativa",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    setGeneratedKey(rawKey);
    setNewKeyName("");
  };

  const handleRevoke = async () => {
    if (!keyToRevoke) return;
    await updateDoc(doc(db, "api_keys", keyToRevoke), {
      status: "revogada",
      updated_at: new Date().toISOString()
    });
    setKeyToRevoke(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Chaves de API</h2>
        <p className="text-slate-500 dark:text-slate-400">Gerencie chaves de acesso para integrações externas.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors duration-300">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Plus className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          Gerar Nova Chave
        </h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Nome da chave (ex: N8N Integration)"
            className="flex-1 px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <button
            onClick={handleGenerateKey}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors w-full sm:w-auto"
          >
            Gerar Chave
          </button>
        </div>

        {generatedKey && (
          <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg space-y-2">
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Chave gerada com sucesso!</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">Copie agora, você não poderá vê-la novamente.</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={generatedKey}
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-900/50 rounded text-sm font-mono text-slate-900 dark:text-slate-100"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedKey);
                  setCopySuccess(true);
                  setTimeout(() => setCopySuccess(false), 2000);
                }}
                className="p-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/30 relative"
              >
                <Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {copySuccess && (
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded animate-in fade-in slide-in-from-bottom-1">
                    Copiado!
                  </span>
                )}
              </button>
            </div>
            <button
              onClick={() => setGeneratedKey(null)}
              className="text-xs text-emerald-700 dark:text-emerald-500 underline"
            >
              Entendi, fechar aviso
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Nome</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Criada em</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{key.nome}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold",
                      key.status === "ativa" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                    )}>
                      {key.status === "ativa" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {key.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {new Date(key.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {key.status === "ativa" && (
                      <button
                        onClick={() => setKeyToRevoke(key.id)}
                        className="text-rose-500 hover:text-rose-700 p-2 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                        title="Revogar Chave"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
          {keys.map((key) => (
            <div key={key.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 dark:text-white">{key.nome}</h4>
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  key.status === "ativa" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                )}>
                  {key.status === "ativa" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {key.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Criada em: {new Date(key.created_at).toLocaleDateString("pt-BR")}</span>
                {key.status === "ativa" && (
                  <button
                    onClick={() => setKeyToRevoke(key.id)}
                    className="flex items-center gap-1 text-rose-500 font-bold uppercase tracking-tighter"
                  >
                    <Trash2 className="w-3 h-3" />
                    Revogar
                  </button>
                )}
              </div>
            </div>
          ))}
          {keys.length === 0 && (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 italic">
              Nenhuma chave de API encontrada.
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmação de Revogação */}
      {keyToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Revogar Chave de API</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Tem certeza que deseja revogar esta chave? Esta ação é irreversível e qualquer integração usando esta chave parará de funcionar imediatamente.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setKeyToRevoke(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRevoke}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                Revogar Chave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
