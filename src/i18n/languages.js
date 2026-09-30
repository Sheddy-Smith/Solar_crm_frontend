/**
 * Languages the CRM UI can be shown in. `itc` is the Google Input Tools code used
 * to convert English-letter typing into the language's script (null = no typing
 * conversion). Codes must match backend `crm_settings.services.LANGUAGE_CODES`.
 */
export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', htmlLang: 'en', itc: null, sample: 'hello' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', htmlLang: 'hi', itc: 'hi-t-i0-und', sample: 'namaste' },
  { code: 'hinglish', name: 'Hinglish', native: 'Hinglish', htmlLang: 'hi-Latn', itc: null, sample: 'namaste' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', htmlLang: 'pa', itc: 'pa-t-i0-und', sample: 'sat sri akal' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', htmlLang: 'gu', itc: 'gu-t-i0-und', sample: 'kem cho' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', htmlLang: 'mr', itc: 'mr-t-i0-und', sample: 'namaskar' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', htmlLang: 'bn', itc: 'bn-t-i0-und', sample: 'nomoskar' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', htmlLang: 'ta', itc: 'ta-t-i0-und', sample: 'vanakkam' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', htmlLang: 'te', itc: 'te-t-i0-und', sample: 'namaskaram' },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
export const DEFAULT_LANGUAGE = 'en';

export function getLanguageMeta(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}

export function isKnownLanguage(code) {
  return LANGUAGE_CODES.includes(code);
}
