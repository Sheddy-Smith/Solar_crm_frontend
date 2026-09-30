import { useSyncExternalStore } from 'react';
import { DEFAULT_LANGUAGE, LANGUAGE_CODES, getLanguageMeta, isKnownLanguage } from './languages.js';
import {
  installDialogTranslation,
  originalAttr,
  originalText,
  refreshPage,
  setDictionary,
  startObserver,
  translateMessage,
} from './runtime.js';
import { setTypingLanguage, startTypingEngine } from './typing.js';

export { LANGUAGES, getLanguageMeta } from './languages.js';
export { originalText, originalAttr } from './runtime.js';

const STORAGE_KEY = 'malwa-solar-crm:i18n';
const localeLoaders = import.meta.glob('./locales/*.json', { import: 'default' });

const listeners = new Set();
let state = {
  language: DEFAULT_LANGUAGE,
  typing: true,
  enabled: [...LANGUAGE_CODES],
  systemDefault: DEFAULT_LANGUAGE,
  explicit: false,
  unsynced: false,
  loading: false,
};
let applySeq = 0;
let pendingSaves = 0;

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      language: state.language,
      typing: state.typing,
      enabled: state.enabled,
      systemDefault: state.systemDefault,
      explicit: state.explicit,
      unsynced: state.unsynced,
    }));
  } catch {
    /* ignore */
  }
}

function emit(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

function syncTyping() {
  const meta = getLanguageMeta(state.language);
  setTypingLanguage(state.typing ? meta.itc : null);
}

async function loadDictionary(code) {
  if (code === 'en') return null;
  const loader = localeLoaders[`./locales/${code}.json`];
  if (!loader) return null;
  try {
    return await loader();
  } catch (err) {
    console.warn(`Could not load ${code} translations`, err);
    return null;
  }
}

async function applyLanguage(code) {
  const seq = ++applySeq;
  emit({ loading: true });
  const entries = await loadDictionary(code);
  if (seq !== applySeq) return;
  setDictionary(entries);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = getLanguageMeta(code).htmlLang;
    document.documentElement.dataset.uiLanguage = code;
  }
  refreshPage();
  emit({ loading: false });
}

function sanitize(code, enabled = state.enabled) {
  return isKnownLanguage(code) && (code === 'en' || enabled.includes(code)) ? code : null;
}

export function getI18nState() {
  return state;
}

export function subscribeI18n(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useI18n() {
  return useSyncExternalStore(subscribeI18n, getI18nState, getI18nState);
}

/** Switch the UI language immediately (does not save to the server). */
export function setLanguage(code) {
  const next = sanitize(code) || DEFAULT_LANGUAGE;
  const changed = next !== state.language;
  emit({ language: next });
  persist();
  syncTyping();
  if (changed) return applyLanguage(next);
  return Promise.resolve();
}

export function setTypingEnabled(enabled) {
  emit({ typing: Boolean(enabled) });
  persist();
  syncTyping();
}

/**
 * Apply the signed-in user's saved preference (from /users/me/ or login):
 * the user's own language, else the admin default, restricted to enabled languages.
 */
export function applyUserPreferences(user) {
  if (!user) return { unsavedLanguage: null };
  const policy = user.i18n || {};
  const enabled = Array.isArray(policy.enabled_languages) && policy.enabled_languages.length
    ? policy.enabled_languages.filter(isKnownLanguage)
    : [...state.enabled];
  if (!enabled.includes('en')) enabled.unshift('en');
  const systemDefault = sanitize(policy.default_language, enabled) || DEFAULT_LANGUAGE;
  if (pendingSaves > 0) {
    // A switcher change is still being saved — don't let a stale profile undo it.
    emit({ enabled, systemDefault });
    persist();
    return { unsavedLanguage: null };
  }
  const serverLanguage = sanitize(user.language, enabled);
  // Picked on this device but not saved yet: before the account had a choice (login page),
  // or the save request failed — keep it and let the caller save it again.
  const keepLocal = state.explicit && (state.unsynced || !serverLanguage);
  const localChoice = keepLocal ? sanitize(state.language, enabled) : null;
  const language = localChoice || serverLanguage || systemDefault;
  const typing = typeof user.typing_transliteration === 'boolean' ? user.typing_transliteration : state.typing;
  const changed = language !== state.language;
  emit({ enabled, systemDefault, typing, language });
  persist();
  syncTyping();
  if (changed) applyLanguage(language);
  return { unsavedLanguage: localChoice && localChoice !== serverLanguage ? localChoice : null };
}

/** Remember whether the last language choice reached the server. */
export function markLanguageSynced(synced) {
  if (state.unsynced === !synced) return;
  emit({ unsynced: !synced });
  persist();
}

/** Wrap a preference save so profile refreshes during the request don't revert it. */
export async function trackPreferenceSave(promise) {
  pendingSaves += 1;
  try {
    return await promise;
  } finally {
    pendingSaves -= 1;
  }
}

export function markExplicitChoice() {
  emit({ explicit: true });
  persist();
}

/** Translate a message for non-DOM surfaces (alerts, native notifications). */
export function t(message) {
  return translateMessage(message);
}

/** Boot: restore the last language before the first render and start observers. */
export function initI18n() {
  if (typeof window === 'undefined') return Promise.resolve();
  const stored = readStored();
  const enabled = Array.isArray(stored.enabled) && stored.enabled.length
    ? stored.enabled.filter(isKnownLanguage)
    : [...LANGUAGE_CODES];
  const language = sanitize(stored.language, enabled) || DEFAULT_LANGUAGE;
  state = {
    ...state,
    enabled,
    language,
    systemDefault: sanitize(stored.systemDefault, enabled) || DEFAULT_LANGUAGE,
    typing: stored.typing !== false,
    explicit: stored.explicit === true,
    unsynced: stored.unsynced === true,
  };
  window.__malwaI18n = { originalText, originalAttr, t: translateMessage };
  installDialogTranslation();
  startTypingEngine();
  syncTyping();
  const ready = language === 'en' ? Promise.resolve() : applyLanguage(language);
  const start = () => startObserver();
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
  return ready;
}
