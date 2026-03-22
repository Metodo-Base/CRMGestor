export interface User {
  uid: string;
  email: string;
  role: 'admin' | 'client';
  allowedClients?: string[]; // Array of client IDs
  name?: string;
  created_at: string;
}

export interface Cliente {
  id: string;
  nome_cliente: string;
  segmento?: string;
  logo_url?: string;
  email_contato: string;
  whatsapp_contato?: string;
  meta_ads_conectado: boolean;
  meta_ads_account_id?: string; // Reference to meta_ads_accounts collection
  google_ads_conectado: boolean;
  google_ads_customer_id?: string;
  ultima_sincronizacao?: string;
  dashboard_url: string;
  created_at: string;
  updated_at: string;
}

export interface MetaAdsAccount {
  id: string; // act_ID
  name: string;
  access_token: string;
  status: 'connected' | 'expired';
  expires_at: string;
  updated_at: string;
}

export interface GoogleAdsAccount {
  id: string; // Customer ID
  name: string;
  refresh_token: string;
  status: 'connected' | 'expired';
  updated_at: string;
}

export interface DadosCampanha {
  id: string;
  cliente_id: string;
  data: string;
  plataforma: 'meta_ads' | 'google_ads';
  campanha_id_externo: string;
  campanha_nome: string;
  adset_id_externo?: string;
  adset_nome?: string;
  ad_id_externo?: string;
  ad_nome?: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  cpc: number;
  ctr: number;
  conversoes: number;
  cpa: number;
  resultados?: number;
  resultados_label?: string;
  whatsapp_conversations?: number;
  alcance?: number;
  frequencia?: number;
  posicao_media?: number;
  indice_qualidade?: number;
  visitas_instagram?: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  cliente_id: string;
  title: string;
  description?: string;
  date: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  cliente_id: string | null; // null for "None"
  title: string;
  content: string;
  date: string;
  created_at: string;
  updated_at: string;
}
