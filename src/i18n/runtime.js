/**
 * DOM translator. Rewrites visible UI text (text nodes + placeholder/title/
 * aria-label/alt) in place using a dictionary generated from the source code
 * (`npm run i18n:sync`). Only strings that exist in that catalog are replaced, so
 * customer data typed into the CRM is never changed or sent anywhere.
 *
 * Nodes are never replaced — only `node.data` / attribute values — so React keeps
 * full control of the tree. The English original is remembered per node, which lets
 * us switch language (or back to English) without a reload and lets other code read
 * the English label via `originalText()`.
 */

const TRANSLATED_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP_TEXT_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE']);
const SKIP_TEXT_SELECTOR = 'script,style,noscript,textarea,code,pre,[data-no-translate],[translate="no"],[contenteditable="true"],[contenteditable=""]';
const SKIP_ATTR_SELECTOR = '[data-no-translate],[translate="no"]';
const MAX_LEN = 400;
const CACHE_LIMIT = 20000;

const PREFIX_RE = /^([\s•·▸›»←→↑↓+*#|:–—-]+)/;
const SUFFIX_RE = /(\s*\(\d[\d,]*\)|[\s:*?!.…,;|–—-]+)$/;

let dict = null;
let lowerDict = null;
let patterns = [];
let cache = new Map();
let observer = null;
let titleObserver = null;
let titleRecord = null;

const textRecords = new WeakMap();
const attrRecords = new WeakMap();

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilePatterns(entries) {
  const out = [];
  for (const [key, value] of entries) {
    if (!key.includes('{')) continue;
    const parts = key.split(/(\{\d+\})/);
    const literal = parts.filter((p) => !/^\{\d+\}$/.test(p)).join('');
    if ((literal.match(/[A-Za-z]/g) || []).length < 3) continue;
    const order = [];
    const source = parts
      .map((p) => {
        const m = /^\{(\d+)\}$/.exec(p);
        if (!m) return escapeRe(p);
        order.push(Number(m[1]));
        return '([\\s\\S]+?)';
      })
      .join('');
    const anchor = parts
      .filter((p) => !/^\{\d+\}$/.test(p))
      .sort((a, b) => b.length - a.length)[0]
      .trim();
    out.push({ re: new RegExp(`^${source}$`), order, value, anchor, weight: literal.length });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

export function setDictionary(entries) {
  if (!entries) {
    dict = null;
    lowerDict = null;
    patterns = [];
  } else {
    // Patterns stay even when unchanged ("{0} | {1} CRM") — their placeholders still get translated.
    // Identity entries stay so brand names ("Malwa Solar Energy") are recognised as "keep as is".
    const list = Object.entries(entries).filter(([k, v]) => k && typeof v === 'string' && v);
    dict = new Map(list.filter(([k]) => !k.includes('{')));
    lowerDict = new Map();
    const byCasePriority = [...dict].sort(([a], [b]) => Number(a === a.toUpperCase()) - Number(b === b.toUpperCase()));
    for (const [k, v] of byCasePriority) {
      const lk = k.toLowerCase();
      if (!lowerDict.has(lk)) lowerDict.set(lk, v);
    }
    patterns = compilePatterns(list.filter(([k, v]) => k !== v || k.includes('{')));
  }
  cache = new Map();
}

function exact(s) {
  return dict.get(s) ?? lowerDict.get(s.toLowerCase()) ?? null;
}

function withAffixes(s) {
  const hit = exact(s);
  if (hit != null) return hit;
  let prefix = '';
  let core = s;
  let suffix = '';
  const pm = PREFIX_RE.exec(core);
  if (pm) {
    prefix = pm[1];
    core = core.slice(prefix.length);
  }
  const sm = SUFFIX_RE.exec(core);
  if (sm && sm.index > 0) {
    suffix = sm[1];
    core = core.slice(0, sm.index);
  }
  if (!core || core === s) return null;
  const inner = exact(core);
  return inner == null ? null : `${prefix}${inner}${suffix}`;
}

function viaPattern(s) {
  for (const p of patterns) {
    if (p.anchor && !s.includes(p.anchor)) continue;
    const m = p.re.exec(s);
    if (!m) continue;
    const values = {};
    p.order.forEach((idx, i) => {
      if (!(idx in values)) values[idx] = m[i + 1];
    });
    return p.value.replace(/\{(\d+)\}/g, (all, idx) => {
      const v = values[idx];
      if (v == null) return all;
      return (/[A-Za-z]/.test(v) && withAffixes(v.trim())) || v;
    });
  }
  return null;
}

/** Translate one UI string; returns null when it isn't a known UI string. */
export function translateString(raw) {
  if (!dict || raw == null) return null;
  const text = String(raw);
  if (!/[A-Za-z]/.test(text)) return null;
  if (cache.has(text)) return cache.get(text);
  let result = null;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  const core = m[2].replace(/\s+/g, ' ');
  if (core && core.length <= MAX_LEN) {
    const hit = withAffixes(core) ?? viaPattern(core);
    if (hit != null && hit !== core) result = `${m[1]}${hit}${m[3]}`;
  }
  if (cache.size > CACHE_LIMIT) cache.clear();
  cache.set(text, result);
  return result;
}

/** Translate a (possibly multi-line) message, e.g. for alert/confirm. */
export function translateMessage(message) {
  if (!dict || typeof message !== 'string') return message;
  const whole = translateString(message);
  if (whole != null) return whole;
  return message
    .split('\n')
    .map((line) => translateString(line) ?? line)
    .join('\n');
}

function currentOriginal(node) {
  const rec = textRecords.get(node);
  return rec && node.data === rec.out ? rec.orig : node.data;
}

/** English text of a node/element even when it is currently shown translated. */
export function originalText(el) {
  if (!el) return '';
  if (el.nodeType === Node.TEXT_NODE) return currentOriginal(el);
  let s = '';
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n = walker.nextNode();
  while (n) {
    s += currentOriginal(n);
    n = walker.nextNode();
  }
  return s;
}

/** English value of a translated attribute (placeholder, title, ...). */
export function originalAttr(el, name) {
  if (!el?.getAttribute) return null;
  const value = el.getAttribute(name);
  const rec = attrRecords.get(el)?.[name];
  return rec && value === rec.out ? rec.orig : value;
}

function keepOptionValue(option) {
  if (option.hasAttribute('value')) return;
  // React reads option.value (text when no value attribute) — pin it to English.
  option.setAttribute('value', originalText(option).replace(/\s+/g, ' ').trim());
}

function processText(node) {
  const rec = textRecords.get(node);
  const current = node.data;
  const orig = rec && current === rec.out ? rec.orig : current;
  const out = dict ? translateString(orig) : null;
  if (out != null) {
    const parent = node.parentElement;
    if (parent?.tagName === 'OPTION') keepOptionValue(parent);
    textRecords.set(node, { orig, out });
    if (current !== out) node.data = out;
  } else {
    if (rec) textRecords.delete(node);
    if (current !== orig) node.data = orig;
  }
}

function processAttrs(el) {
  let recs = attrRecords.get(el);
  for (const name of TRANSLATED_ATTRS) {
    if (!el.hasAttribute(name)) continue;
    const current = el.getAttribute(name);
    const rec = recs?.[name];
    const orig = rec && current === rec.out ? rec.orig : current;
    const out = dict ? translateString(orig) : null;
    if (out != null) {
      if (!recs) {
        recs = {};
        attrRecords.set(el, recs);
      }
      recs[name] = { orig, out };
      if (current !== out) el.setAttribute(name, out);
    } else {
      if (rec) delete recs[name];
      if (current !== orig) el.setAttribute(name, orig);
    }
  }
}

function isTextSkipped(el) {
  return !el || Boolean(el.closest(SKIP_TEXT_SELECTOR));
}

function acceptNode(n) {
  if (n.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
  if (n.hasAttribute('data-no-translate') || n.getAttribute('translate') === 'no') return NodeFilter.FILTER_REJECT;
  processAttrs(n);
  if (SKIP_TEXT_TAGS.has(n.tagName.toUpperCase()) || n.isContentEditable) return NodeFilter.FILTER_REJECT;
  return NodeFilter.FILTER_SKIP;
}

function processTree(root) {
  if (root.nodeType === Node.TEXT_NODE) {
    if (!isTextSkipped(root.parentElement)) processText(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if (root.closest(SKIP_ATTR_SELECTOR)) return;
  if (isTextSkipped(root.parentElement)) {
    processAttrs(root);
    return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode });
  if (acceptNode(root) === NodeFilter.FILTER_REJECT) return;
  let n = walker.nextNode();
  while (n) {
    processText(n);
    n = walker.nextNode();
  }
}

function processTitle() {
  const current = document.title;
  const orig = titleRecord && current === titleRecord.out ? titleRecord.orig : current;
  const out = dict ? translateString(orig) : null;
  titleRecord = out != null ? { orig, out } : null;
  const next = out ?? orig;
  if (next !== current) document.title = next;
  titleObserver?.takeRecords();
}

function hasAncestorIn(node, set) {
  let p = node.parentNode;
  while (p) {
    if (set.has(p)) return true;
    p = p.parentNode;
  }
  return false;
}

function onMutations(records) {
  if (!dict) return;
  const roots = new Set();
  const attrTargets = new Set();
  for (const r of records) {
    if (r.type === 'childList') r.addedNodes.forEach((n) => roots.add(n));
    else if (r.type === 'characterData') roots.add(r.target);
    else attrTargets.add(r.target);
  }
  for (const n of roots) {
    if (!n.isConnected) continue;
    // A subtree walk already covers descendants that are also in the batch.
    if (roots.size > 1 && hasAncestorIn(n, roots)) continue;
    processTree(n);
  }
  for (const el of attrTargets) {
    if (el.isConnected && !roots.has(el) && !el.closest(SKIP_ATTR_SELECTOR)) processAttrs(el);
  }
  // Discard the mutations we just caused ourselves.
  observer?.takeRecords();
}

/** Re-translate everything currently on the page (after a language change). */
export function refreshPage() {
  if (typeof document === 'undefined' || !document.body) return;
  processTree(document.body);
  observer?.takeRecords();
  processTitle();
}

export function startObserver() {
  if (observer || typeof MutationObserver === 'undefined' || !document.body) return;
  observer = new MutationObserver(onMutations);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: TRANSLATED_ATTRS,
  });
  const titleEl = document.querySelector('title');
  if (titleEl) {
    titleObserver = new MutationObserver(processTitle);
    titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
  }
}

export function installDialogTranslation() {
  if (typeof window === 'undefined' || window.__malwaI18nDialogs) return;
  window.__malwaI18nDialogs = true;
  const nativeAlert = window.alert.bind(window);
  const nativeConfirm = window.confirm.bind(window);
  const nativePrompt = window.prompt.bind(window);
  window.alert = (message) => nativeAlert(translateMessage(message));
  window.confirm = (message) => nativeConfirm(translateMessage(message));
  window.prompt = (message, value) => nativePrompt(translateMessage(message), value);
}
