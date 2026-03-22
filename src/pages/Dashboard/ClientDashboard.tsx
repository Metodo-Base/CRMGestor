import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Cliente } from "../../types";
import { MessageCircle, Sun, Moon } from "lucide-react";
import DashboardContent from "../../components/dashboard/DashboardContent";
import { useTheme } from "../../context/ThemeContext";

export default function ClientDashboard() {
  const { id } = useParams();
  const { theme, toggleTheme } = useTheme();
  const [cliente, setCliente] = useState<Cliente | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchCliente = async () => {
      const snap = await getDoc(doc(db, "clientes", id));
      if (snap.exists()) {
        setCliente(snap.data() as Cliente);
      }
    };
    fetchCliente();
  }, [id]);

  if (!id) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 pb-20 transition-colors duration-300">
      {/* Public Header with Theme Toggle */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {cliente?.logo_url ? (
              <img src={cliente.logo_url} alt={cliente.nome_cliente} className="h-8 w-auto" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">Dashboard</span>
            )}
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={theme === 'light' ? 'Mudar para modo escuro' : 'Mudar para modo claro'}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <main className="pt-8">
        <DashboardContent clienteId={id} isInternal={false} />
      </main>

      {/* Floating Contact Button */}
      {cliente?.whatsapp_contato && (
        <a
          href={`https://wa.me/${cliente.whatsapp_contato.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-8 right-8 bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 flex items-center gap-2 group z-50"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-bold">
            Falar com Gestor
          </span>
        </a>
      )}

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200 dark:border-slate-800 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Natan - Gestor de Tráfego</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Especialista em Performance & CRM</p>
          </div>
          <div className="flex items-center gap-6 text-xs font-medium text-slate-500 dark:text-slate-400">
            <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Política de Privacidade</a>
            <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Termos de Uso</a>
          </div>
          <div className="text-center md:text-right">
            <p className="text-xs text-slate-400 dark:text-slate-500">© 2026 CRM Gestor. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
