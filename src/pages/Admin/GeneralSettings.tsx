import { useState } from 'react';
import { Settings, Key, Brain, FileText, Activity, Sparkles, Database } from 'lucide-react';
import { cn } from '../../lib/utils';
import ApiKeys from './ApiKeys';
import IaConfig from './IaConfig';
import IaLogs from './IaLogs';
import ApiDocs from './ApiDocs';
import AiInsights from './AiInsights';
import MetaAdsSettings from './MetaAdsSettings';

type TabType = 'api-keys' | 'ia-config' | 'ia-logs' | 'api-docs' | 'ia-insights' | 'meta-accounts';

export default function GeneralSettings() {
  const [activeTab, setActiveTab] = useState<TabType>('api-keys');

  const tabs = [
    { id: 'api-keys', label: 'Chaves de API', icon: Key },
    { id: 'ia-insights', label: 'Insights IA', icon: Sparkles },
    { id: 'ia-config', label: 'Configuração IA', icon: Brain },
    { id: 'ia-logs', label: 'Logs de IA', icon: Activity },
    { id: 'api-docs', label: 'Documentação', icon: FileText },
    { id: 'meta-accounts', label: 'Contas Meta', icon: Database },
  ] as const;

  const renderContent = () => {
    switch (activeTab) {
      case 'api-keys': return <ApiKeys />;
      case 'ia-insights': return <AiInsights />;
      case 'ia-config': return <IaConfig />;
      case 'ia-logs': return <IaLogs />;
      case 'api-docs': return <ApiDocs />;
      case 'meta-accounts': return <MetaAdsSettings />;
      default: return <ApiKeys />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
            <Settings className="w-10 h-10 text-indigo-600" />
            Configurações Gerais
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            Gerencie as chaves, logs e configurações do sistema
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 p-2 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm border border-slate-200 dark:border-slate-800"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-8 shadow-sm">
        {renderContent()}
      </div>
    </div>
  );
}
