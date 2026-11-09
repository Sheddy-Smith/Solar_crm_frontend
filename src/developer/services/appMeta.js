const PROD_API_FALLBACK = 'https://api.crm.ecomalwa.com/api/v1';

export const API_BASE_PUBLIC =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api/v1' : PROD_API_FALLBACK);
