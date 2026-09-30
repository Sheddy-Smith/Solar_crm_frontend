#!/usr/bin/env node
/**
 * Extracts every user-facing string from the frontend (JSX text, UI string
 * literals, template literals as `{0}` patterns) and from backend API
 * messages, and writes scripts/i18n/catalog.json.
 *
 * Only strings in this catalog are ever translated at runtime, so customer
 * data (names, addresses, notes) is never sent anywhere or altered.
 *
 * Usage: node scripts/i18n/extract.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = join(ROOT, 'scripts', 'i18n', 'catalog.json');

const SKIP_ATTRS = new Set([
  'className', 'key', 'id', 'type', 'name', 'href', 'src', 'to', 'htmlFor', 'role', 'rel', 'target',
  'method', 'inputMode', 'autoComplete', 'accept', 'pattern', 'lang', 'dir', 'form', 'style', 'd',
  'viewBox', 'fill', 'stroke', 'xmlns', 'layoutId', 'value', 'defaultValue', 'encType', 'action',
  'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'capture', 'loading', 'decoding', 'sizes', 'srcSet',
  'min', 'max', 'step', 'mode', 'variant', 'tone', 'size', 'color', 'icon', 'align', 'position',
]);
const SKIP_CALLEES = new Set([
  'cx', 'clsx', 'classNames', 'request', 'fetch', 'querySelector', 'querySelectorAll', 'closest', 'matches',
  'addEventListener', 'removeEventListener', 'getItem', 'setItem', 'removeItem', 'getElementById',
  'createElement', 'getAttribute', 'setAttribute', 'removeAttribute', 'toggle', 'add', 'remove', 'contains',
  'require', 'RegExp', 'getPropertyValue', 'setProperty', 'postMessage', 'open', 'toLocaleString',
  'toLocaleDateString', 'toLocaleTimeString', 'Intl', 'DateTimeFormat', 'NumberFormat', 'split', 'join',
  'replace', 'replaceAll', 'startsWith', 'endsWith', 'includes', 'indexOf', 'padStart', 'padEnd', 'dispatchEvent',
  'CustomEvent', 'Event', 'Blob', 'URL', 'URLSearchParams', 'append', 'set', 'get', 'has', 'delete', 'test', 'match',
]);
const SKIP_VAR_NAME = /(class|Class|CLASS|^BTN|_BTN|PANEL|STYLE|Style|TONE|Tone|COLOR|Color|ICON|URL|Url|API|Api|KEY|Key|PATH|Path|ROUTE|Route|REGEX|Regex|PATTERN|MIME|FONT|Font)$|^(BTN|PANEL|FIELD|INPUT|CARD|CHIP|PILL)/;

export function normalize(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

export function isUiString(raw) {
  const t = normalize(raw);
  if (t.length < 2 || t.length > 400) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  if (/^(https?:|mailto:|tel:|data:|blob:|\/|\.\/|\.\.\/|#)/i.test(t)) return false;
  if (/<\/?[a-z][^>]*>/i.test(t)) return false;
  if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(t)) return false;
  if (/^[a-z][a-zA-Z0-9]*$/.test(t)) return false;
  if (/^[a-z0-9_.]+$/.test(t)) return false;
  if (/^[A-Z0-9_]+$/.test(t)) return false;
  if (/^[a-z]+(-[a-z0-9]+)+$/.test(t)) return false;
  if (/^[\w-]+\.(jsx?|mjs|css|png|jpe?g|svg|webp|gif|pdf|json|xlsx?|csv|html?|txt|zip)$/i.test(t)) return false;
  if (/rgba?\(|\d+px\b|var\(--|calc\(|linear-gradient|^\d+(\.\d+)?(ms|s|%|rem|em|vh|vw)$/.test(t)) return false;
  if (/^[a-z]+\/[a-z0-9.+-]+$/i.test(t)) return false;
  if (/^(yyyy|dd|mm|hh)[-/: ]/i.test(t)) return false;
  if (/[{};]\s*$/.test(t) && /[:=]/.test(t) && !/\{\d+\}/.test(t)) return false;
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP) /.test(t)) return false;
  if (!/[a-z]/.test(t.replace(/\{\d+\}/g, '')) && /\d/.test(t)) return false;
  if ((t.replace(/\{\d+\}/g, '').match(/[A-Za-z]/g) || []).length < 2) return false;
  if (/^\d{1,2} [A-Z][a-z]{2,8},? \d{4}/.test(t) || /^[A-Z][a-z]{2} \d{1,2},? \d{4}/.test(t)) return false;
  if (/^[A-Z]{2,5}-[A-Z0-9-]*\{\d+\}/.test(t)) return false;
  const tokens = t.split(' ');
  if (!/[A-Z]/.test(t)) {
    if (tokens.length < 2) return false;
    if (tokens.some((tok) => /[-:[\]/#=()_]/.test(tok) && !/^[a-z]+-[a-z]+$/.test(tok))) return false;
    if (tokens.every((tok) => /^[a-z0-9-]+$/.test(tok)) && tokens.some((tok) => /-/.test(tok))) return false;
  }
  const classy = tokens.filter((tok) => /^!?-?[a-z0-9]+(?:[-:/.][a-zA-Z0-9[\]#%.()_,'"]+)+$/.test(tok) && /[-:[]/.test(tok)).length;
  if (classy > 0 && classy >= tokens.length / 2) return false;
  return true;
}

function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'locales' || entry.startsWith('.') || entry === '__pycache__') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.includes(extname(entry))) out.push(full);
  }
  return out;
}

function calleeName(node) {
  if (!node) return '';
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') return node.property.name;
  return '';
}

function calleeObjectName(node) {
  if (node?.type === 'MemberExpression' && node.object.type === 'Identifier') return node.object.name;
  return '';
}

function inSkippedContext(path) {
  let current = path;
  while (current && current.parentPath) {
    const parent = current.parentPath;
    const pn = parent.node;
    if (pn.type === 'JSXAttribute') {
      const name = pn.name.type === 'JSXIdentifier' ? pn.name.name : `${pn.name.namespace.name}:${pn.name.name.name}`;
      if (SKIP_ATTRS.has(name) || name.startsWith('data-') || name === 'aria-hidden') return true;
      return false;
    }
    if (pn.type === 'CallExpression' || pn.type === 'NewExpression') {
      const name = calleeName(pn.callee);
      const obj = calleeObjectName(pn.callee);
      if (SKIP_CALLEES.has(name) || ['console', 'localStorage', 'sessionStorage', 'classList', 'JSON', 'Object', 'Math', 'document', 'navigator'].includes(obj)) return true;
      if (name === 'useState' || name === 'useRef') return false;
    }
    if (pn.type === 'ImportDeclaration' || pn.type === 'ImportExpression') return true;
    if ((pn.type === 'ExportNamedDeclaration' || pn.type === 'ExportAllDeclaration') && pn.source === current.node) return true;
    if (pn.type === 'ObjectProperty' && pn.key === current.node) return true;
    if (pn.type === 'ObjectProperty' && !pn.computed) {
      const key = pn.key.type === 'Identifier' ? pn.key.name : pn.key.value;
      if (/^(className|class|style|color|tone|icon|bg|border|text|fill|stroke|accent|ring|dot|badge|pill|chip|gradient|shadow|path|url|href|route|endpoint|api|key|id|type|mime|format|pattern|regex|field|value|sortKey|countKey|loader|module|permission|name|slug|code|itc|gt)$/i.test(key) && typeof pn.value?.value === 'string') {
        if (!/^(name)$/i.test(key)) return true;
      }
    }
    if (pn.type === 'MemberExpression' && pn.computed && pn.property === current.node) return true;
    if (pn.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(pn.operator)) return true;
    if (pn.type === 'SwitchCase' && pn.test === current.node) return true;
    if (pn.type === 'VariableDeclarator' && pn.id.type === 'Identifier' && SKIP_VAR_NAME.test(pn.id.name)) return true;
    if (pn.type === 'Program') return false;
    current = parent;
  }
  return false;
}

function templatePattern(node) {
  let out = '';
  node.quasis.forEach((q, i) => {
    out += q.value.cooked ?? q.value.raw;
    if (i < node.expressions.length) out += `{${i}}`;
  });
  return out;
}

function extractFrontend() {
  const found = new Set();
  // languages.js holds native names and typing samples, which must stay as written.
  const files = walk(join(ROOT, 'src'), ['.js', '.jsx']).filter((f) => !/[\\/]i18n[\\/]languages\.js$/.test(f));
  for (const file of files) {
    const code = readFileSync(file, 'utf8');
    let ast;
    try {
      ast = parse(code, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
    } catch (e) {
      console.warn(`skip ${relative(ROOT, file)}: ${e.message}`);
      continue;
    }
    traverse(ast, {
      JSXText(path) {
        const text = normalize(path.node.value);
        if (text && isUiString(text)) found.add(text);
      },
      StringLiteral(path) {
        if (inSkippedContext(path)) return;
        const text = normalize(path.node.value);
        if (isUiString(text)) found.add(text);
      },
      TemplateLiteral(path) {
        if (path.parentPath.node.type === 'TaggedTemplateExpression') return;
        if (inSkippedContext(path)) return;
        const pattern = normalize(templatePattern(path.node));
        const staticText = pattern.replace(/\{\d+\}/g, ' ').trim();
        if (!staticText || !isUiString(staticText)) return;
        if (pattern.length > 300 || /<\/?[a-z]/i.test(pattern)) return;
        if (/^\{\d+\}$/.test(pattern)) return;
        found.add(pattern);
      },
    });
  }
  return found;
}

function extractBackend() {
  const found = new Set();
  const files = walk(join(ROOT, 'backend', 'apps'), ['.py']).filter((f) => !/[\\/](migrations|management)[\\/]/.test(f) && !/[\\/]tests?[^\\/]*\.py$/.test(f));
  const literal = /\b(f?)(['"])((?:\\.|(?!\2).)*)\2/g;
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed.startsWith('"""') || trimmed.startsWith("'''")) continue;
      let m;
      literal.lastIndex = 0;
      while ((m = literal.exec(line))) {
        let text = m[3].replace(/\\'/g, "'").replace(/\\"/g, '"');
        if (m[1] === 'f') {
          let i = 0;
          text = text.replace(/\{[^{}]+\}/g, () => `{${i++}}`);
        } else if (/[{%]/.test(text)) continue;
        text = normalize(text);
        if (!/^[A-Z]/.test(text) || !text.includes(' ') || text.length > 250) continue;
        if (/[_]{2}|\bself\b|\bdef\b|=>|::/.test(text)) continue;
        if (isUiString(text)) found.add(text);
      }
    }
  }
  return found;
}

const frontend = extractFrontend();
const backend = extractBackend();
const all = [...new Set([...frontend, ...backend])].sort((a, b) => a.localeCompare(b));
writeFileSync(OUT, `${JSON.stringify(all, null, 1)}\n`);
console.log(`frontend: ${frontend.size}, backend: ${backend.size}, total unique: ${all.length}`);
console.log(`chars: ${all.reduce((n, s) => n + s.length, 0)}`);
