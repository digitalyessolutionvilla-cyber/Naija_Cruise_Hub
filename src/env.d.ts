/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_9JA_ANALYTICS_ENABLED?: string;
  readonly VITE_9JA_ANALYTICS_TOKEN?: string;
  readonly VITE_9JA_PROJECT_ID?: string;
  readonly VITE_9JA_ANALYTICS_ENDPOINT?: string;
  readonly VITE_9JA_ANALYTICS_DEFINITIONS_ENDPOINT?: string;
  readonly VITE_9JA_ANALYTICS_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
