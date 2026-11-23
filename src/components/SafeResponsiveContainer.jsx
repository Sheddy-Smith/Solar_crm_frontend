import { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';

/**
 * Mounts Recharts ResponsiveContainer only when the host has positive
 * width/height. Avoids console warnings when a parent is `display: none`
 * (e.g. mobile + desktop dashboards both mounted, one CSS-hidden).
 */
export function SafeResponsiveContainer({
  children,
  className = 'h-full w-full min-h-0 min-w-0',
  minWidth = 0,
  debounceMs = 32,
  ...props
}) {
  const hostRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;

    let raf = 0;
    let timer = 0;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setReady(width > 0 && height > 0);
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      raf = requestAnimationFrame(() => {
        timer = window.setTimeout(measure, debounceMs);
      });
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', schedule);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        window.removeEventListener('resize', schedule);
      };
    }

    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [debounceMs]);

  return (
    <div ref={hostRef} className={className}>
      {ready ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={minWidth} {...props}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

export default SafeResponsiveContainer;
