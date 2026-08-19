/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_ADSENSE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_ADSENSE_SLOT_INTERSTITIAL?: string;
  readonly VITE_GOOGLE_ADSENSE_SLOT_BANNER?: string;
  readonly VITE_GOOGLE_ADMOB_APP_ID?: string;
  readonly VITE_GOOGLE_ADMOB_UNIT_INTERSTITIAL?: string;
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
