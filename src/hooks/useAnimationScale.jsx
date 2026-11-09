import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import {
  bootstrapAnimationScales,
  getAnimationScales,
  motionDuration,
  subscribeAnimationScales,
  writeAnimationScales,
} from '../lib/animationScale.js';

const AnimationScaleContext = createContext({
  scales: getAnimationScales(),
  setScale: () => {},
  setScales: () => {},
  motionDuration,
});

export function AnimationScaleProvider({ children }) {
  const [scales, setScalesState] = useState(() => bootstrapAnimationScales());

  useEffect(() => subscribeAnimationScales((next) => setScalesState({ ...next })), []);

  const setScales = useCallback((next) => {
    setScalesState(writeAnimationScales(next));
  }, []);

  const setScale = useCallback((key, value) => {
    setScalesState((prev) => writeAnimationScales({ ...prev, [key]: value }));
  }, []);

  const value = useMemo(
    () => ({
      scales,
      setScale,
      setScales,
      motionDuration: (base, kind = 'animator') => {
        const factor = scales[kind];
        if (!Number.isFinite(factor) || factor <= 0) return 0;
        return Number(base) * factor;
      },
    }),
    [scales, setScale, setScales],
  );

  const animatorDuration = value.motionDuration(0.15, 'animator');

  return (
    <AnimationScaleContext.Provider value={value}>
      <MotionConfig reducedMotion="never" transition={{ duration: animatorDuration, ease: 'easeOut' }}>
        {children}
      </MotionConfig>
    </AnimationScaleContext.Provider>
  );
}

export function useAnimationScale() {
  return useContext(AnimationScaleContext);
}

export function useScaledTransition(baseSeconds, kind = 'animator', ease = 'easeOut') {
  const { motionDuration: md } = useAnimationScale();
  return useMemo(
    () => ({ duration: md(baseSeconds, kind), ease }),
    [md, baseSeconds, kind, ease],
  );
}
