/**
 * CRM-only animation scale preferences (Android Developer Options–style).
 * Affects in-app CSS / Framer Motion durations — never OS system animations.
 */

export const ANIMATION_SCALE_STORAGE_KEY = 'malwa-solar-crm:animation-scales';

export const ANIMATION_SCALE_OPTION_VALUES = [0, 0.5, 1, 1.5, 2, 5, 10];

export const DEFAULT_ANIMATION_SCALE = 0.5;

export const ANIMATION_SCALE_KEYS = {
  window: 'window',
  transition: 'transition',
  animator: 'animator',
};

/** @typedef {'window' | 'transition' | 'animator'} AnimationScaleKind */

const LISTENERS = new Set();

/** @type {{ window: number, transition: number, animator: number }} */
let memoryScales = {
  window: DEFAULT_ANIMATION_SCALE,
  transition: DEFAULT_ANIMATION_SCALE,
  animator: DEFAULT_ANIMATION_SCALE,
};

export function formatAnimationScaleLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'Animation off';
  const pretty = Number.isInteger(n) ? String(n) : String(n);
  return `Animation scale ${pretty}x`;
}

export function parseAnimationScaleValue(raw) {
  if (raw === 'off' || raw === 'Animation off') return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_ANIMATION_SCALE;
  const match = ANIMATION_SCALE_OPTION_VALUES.find((v) => Math.abs(v - n) < 0.001);
  return match === undefined ? DEFAULT_ANIMATION_SCALE : match;
}

function sanitizeScales(input) {
  const src = input && typeof input === 'object' ? input : {};
  return {
    window: parseAnimationScaleValue(src.window),
    transition: parseAnimationScaleValue(src.transition),
    animator: parseAnimationScaleValue(src.animator),
  };
}

export function getAnimationScales() {
  return { ...memoryScales };
}

export function readAnimationScales() {
  if (typeof window === 'undefined') {
    return { ...memoryScales };
  }
  try {
    const raw = window.localStorage.getItem(ANIMATION_SCALE_STORAGE_KEY);
    if (!raw) return sanitizeScales({});
    return sanitizeScales(JSON.parse(raw));
  } catch {
    return sanitizeScales({});
  }
}

export function writeAnimationScales(next) {
  const scales = sanitizeScales(next);
  memoryScales = scales;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ANIMATION_SCALE_STORAGE_KEY, JSON.stringify(scales));
    } catch {
      /* ignore quota */
    }
  }
  applyAnimationScalesToDocument(scales);
  LISTENERS.forEach((fn) => {
    try {
      fn(scales);
    } catch {
      /* ignore */
    }
  });
  return scales;
}

export function subscribeAnimationScales(listener) {
  LISTENERS.add(listener);
  return () => LISTENERS.delete(listener);
}

export function applyAnimationScalesToDocument(scales = memoryScales) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const s = sanitizeScales(scales);
  root.style.setProperty('--crm-window-anim-scale', String(s.window));
  root.style.setProperty('--crm-transition-anim-scale', String(s.transition));
  root.style.setProperty('--crm-animator-duration-scale', String(s.animator));
  root.dataset.crmWindowAnim = s.window <= 0 ? 'off' : 'on';
  root.dataset.crmTransitionAnim = s.transition <= 0 ? 'off' : 'on';
  root.dataset.crmAnimatorAnim = s.animator <= 0 ? 'off' : 'on';
}

/** Multiply a base duration (seconds) by the selected scale. 0 = off. */
export function motionDuration(baseSeconds, kind = 'animator') {
  const factor = memoryScales[kind] ?? DEFAULT_ANIMATION_SCALE;
  if (!Number.isFinite(factor) || factor <= 0) return 0;
  const base = Number(baseSeconds);
  if (!Number.isFinite(base) || base < 0) return 0;
  return base * factor;
}

export function bootstrapAnimationScales() {
  const scales = readAnimationScales();
  memoryScales = scales;
  applyAnimationScalesToDocument(scales);
  return scales;
}

export const ANIMATION_SCALE_SETTINGS = [
  {
    key: 'window',
    title: 'Window animation scale',
    description: 'Controls CRM modal / dialog open & close animations.',
  },
  {
    key: 'transition',
    title: 'Transition animation scale',
    description: 'Controls CRM page / navigation transition animations.',
  },
  {
    key: 'animator',
    title: 'Animator duration scale',
    description: 'Controls CRM component micro-animations (buttons, chips, pills).',
  },
];
