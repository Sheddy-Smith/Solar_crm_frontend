/**
 * Phonetic typing: the user types with English letters and the word before the
 * caret is converted into the selected language's script when Space, Enter or
 * punctuation is pressed (e.g. "namaste" → "नमस्ते"). Backspace right after a
 * conversion restores the English word. Uses Google Input Tools; if it is
 * unreachable the English text is simply kept.
 *
 * Only free-text fields are converted — email, phone, password, numbers and code
 * style fields (GST, IVRS, PAN, IFSC, amounts, ...) are left untouched.
 */
import { originalAttr, originalText } from './runtime.js';

const ENDPOINT = 'https://inputtools.google.com/request';
const TEXT_INPUT_TYPES = new Set(['', 'text', 'search']);
const BLOCKED_INPUT_MODES = new Set(['numeric', 'decimal', 'tel', 'email', 'url']);
const BLOCKED_AUTOCOMPLETE = /(email|tel|username|password|one-time-code|postal-code|cc-|url)/i;
const BLOCKED_HINT = /(e-?mail|phone|mobile|whats ?app|contact no|password|passcode|\botp\b|\bpin\b|pin ?code|postal|\bzip\b|\bgst|\bivrs|\bpan\b|aadha+r|\bifsc|account no|account number|a\/c|\bupi\b|\bcode\b|\bnumber\b|\bno\b\.?|\bqty\b|quantity|\brate\b|price|amount|\bkw|watt|capacity|percent|%|\burl\b|website|\blink\b|username|user id|login|serial|\bsku\b|\bhsn\b|\bsac\b|\bref\b|reference no|\bdate\b|\btime\b|\byear\b|latitude|longitude|\blat\b|\blng\b|meter no|\bcin\b|\btan\b|\bbank\b|\bcheque\b|\butr\b|\bprefix\b|\bformat\b|\bapi\b|\btoken\b|\bkey\b|\bsecret\b)/i;
const DELIMITERS = new Set([' ', 'Enter', ',', '.', ';', ':', '!', '?', ')']);
const WORD_BEFORE_CARET = /([A-Za-z]+)$/;

let itc = null;
let started = false;
const cache = new Map();
const inflight = new Map();
let lastConversion = null;
let prefetchTimer = 0;

function cacheKey(word, code = itc) {
  return `${code}|${word.toLowerCase()}`;
}

function fetchWord(word, code = itc) {
  const key = cacheKey(word, code);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (inflight.has(key)) return inflight.get(key);
  const url = `${ENDPOINT}?text=${encodeURIComponent(word)}&itc=${code}&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&app=malwa-crm`;
  const request = fetch(url)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const out = data?.[0] === 'SUCCESS' ? data?.[1]?.[0]?.[1]?.[0] : null;
      const value = typeof out === 'string' && out ? out : null;
      if (value) cache.set(key, value);
      return value;
    })
    .catch(() => null)
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

function labelTextFor(el) {
  const parts = [];
  if (el.labels?.length) parts.push(...Array.from(el.labels).map((l) => originalText(l)));
  const wrapping = el.closest('label');
  if (wrapping) parts.push(originalText(wrapping));
  const parent = el.parentElement;
  const sibling = parent?.querySelector(':scope > label, :scope > span, :scope > p');
  if (sibling && !sibling.contains(el)) parts.push(originalText(sibling));
  const grand = parent?.parentElement?.querySelector(':scope > label, :scope > span, :scope > p');
  if (grand && !grand.contains(el)) parts.push(originalText(grand));
  return parts.join(' ').slice(0, 300);
}

function isEligible(el) {
  if (!itc || !el) return false;
  let isText = false;
  if (el instanceof HTMLTextAreaElement) isText = true;
  else if (el instanceof HTMLInputElement) isText = TEXT_INPUT_TYPES.has((el.getAttribute('type') || '').toLowerCase());
  if (!isText || el.readOnly || el.disabled) return false;
  if (el.closest('[data-no-transliterate]')) return false;
  if (BLOCKED_INPUT_MODES.has((el.inputMode || '').toLowerCase())) return false;
  if (BLOCKED_AUTOCOMPLETE.test(el.getAttribute('autocomplete') || '')) return false;
  if (el.dataset.transliterate === 'on') return true;
  const hint = [
    el.name,
    el.id,
    originalAttr(el, 'placeholder'),
    originalAttr(el, 'aria-label'),
    originalAttr(el, 'title'),
    labelTextFor(el),
  ].filter(Boolean).join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ');
  return !BLOCKED_HINT.test(hint);
}

function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function wordBeforeCaret(el) {
  const caret = el.selectionStart;
  if (caret == null || caret !== el.selectionEnd) return null;
  const before = el.value.slice(0, caret);
  const m = WORD_BEFORE_CARET.exec(before);
  if (!m) return null;
  const word = m[1];
  const start = caret - word.length;
  const prev = before[start - 1];
  // Part of an email, URL, code or number (abc@x, a/b, INV-12, 5kw) — leave as typed.
  if (prev && /[\w@./\\:#&=+_-]/.test(prev)) return null;
  // Acronyms like GST / KW stay English.
  if (word.length > 1 && word === word.toUpperCase()) return null;
  if (lastConversion?.skip && lastConversion.el === el && lastConversion.start === start && lastConversion.word === word) return null;
  return { word, start, end: caret };
}

/** Replace [start, start+word.length) with `out` if the word is still there. */
function replaceWord(el, start, word, out) {
  const value = el.value;
  if (value.slice(start, start + word.length) !== word) return false;
  const caret = el.selectionStart;
  const next = value.slice(0, start) + out + value.slice(start + word.length);
  const delta = out.length - word.length;
  setNativeValue(el, next);
  if (document.activeElement === el && caret != null) {
    const pos = caret >= start + word.length ? caret + delta : caret;
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      /* ignore */
    }
  }
  lastConversion = { el, start, word, out, end: start + out.length, skip: false };
  return true;
}

function onKeyDown(event) {
  if (!itc || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
  const el = event.target;

  if (event.key === 'Backspace') {
    const last = lastConversion;
    if (last && last.el === el && !last.skip && el.selectionStart === el.selectionEnd) {
      const caret = el.selectionStart;
      const value = el.value;
      const tail = value.slice(last.end, caret);
      if (caret >= last.end && caret - last.end <= 1 && value.slice(last.start, last.end) === last.out && !/[A-Za-z0-9]/.test(tail)) {
        event.preventDefault();
        const next = value.slice(0, last.start) + last.word + value.slice(caret);
        setNativeValue(el, next);
        const pos = last.start + last.word.length;
        el.setSelectionRange(pos, pos);
        lastConversion = { el, start: last.start, word: last.word, skip: true };
        return;
      }
    }
    lastConversion = null;
    return;
  }

  if (!DELIMITERS.has(event.key)) {
    if (event.key.length === 1 || event.key === 'Delete') {
      if (lastConversion && !lastConversion.skip) lastConversion = null;
    }
    return;
  }
  if (!isEligible(el)) return;
  const target = wordBeforeCaret(el);
  if (!target) return;

  const cached = cache.get(cacheKey(target.word));
  if (cached) {
    replaceWord(el, target.start, target.word, cached);
    return;
  }

  const isSingleLineEnter = event.key === 'Enter' && el instanceof HTMLInputElement;
  // Hold back form submission until the word has been converted.
  if (isSingleLineEnter) event.preventDefault();
  fetchWord(target.word).then((out) => {
    if (out) replaceWord(el, target.start, target.word, out);
  });
}

function onInput(event) {
  if (!itc) return;
  const el = event.target;
  window.clearTimeout(prefetchTimer);
  prefetchTimer = window.setTimeout(() => {
    if (document.activeElement !== el || !isEligible(el)) return;
    const target = wordBeforeCaret(el);
    if (target && target.word.length > 1) fetchWord(target.word);
  }, 160);
}

function onFocusOut(event) {
  if (!itc) return;
  const el = event.target;
  if (!isEligible(el)) return;
  const m = WORD_BEFORE_CARET.exec(el.value);
  if (!m) return;
  const word = m[1];
  const start = el.value.length - word.length;
  const prev = el.value[start - 1];
  if (prev && /[\w@./\\:#&=+_-]/.test(prev)) return;
  if (word.length > 1 && word === word.toUpperCase()) return;
  if (lastConversion?.skip && lastConversion.el === el && lastConversion.start === start) return;
  // Only convert from cache on blur so a save click never races an async update.
  const cached = cache.get(cacheKey(word));
  if (cached) replaceWord(el, start, word, cached);
}

export function setTypingLanguage(code) {
  itc = code || null;
  lastConversion = null;
}

export function isTypingActive() {
  return Boolean(itc);
}

/** Convert a whole phrase (used by the Settings preview box). */
export async function transliteratePhrase(text, code) {
  if (!code) return text;
  const words = String(text).split(/(\s+)/);
  const out = await Promise.all(words.map((w) => (/^[A-Za-z]+$/.test(w) ? fetchWord(w, code).then((r) => r || w) : w)));
  return out.join('');
}

export function startTypingEngine() {
  if (started || typeof document === 'undefined') return;
  started = true;
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('input', onInput, true);
  document.addEventListener('focusout', onFocusOut, true);
  document.addEventListener('pointerdown', () => {
    lastConversion = null;
  }, true);
}
