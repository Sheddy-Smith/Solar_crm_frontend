import { motion } from 'framer-motion';
import { Sun, Moon, Monitor } from 'lucide-react';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** 3-way Light/Dark/System toggle with an animated sliding active-pill. */
function ThemeToggle({ theme, onChange, className = '' }) {
  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border border-[#dce7f5] bg-white p-1 dark:border-slate-600 dark:bg-slate-800 ${className}`}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className="relative inline-flex size-8 items-center justify-center rounded-full"
            aria-label={`${label} theme`}
            aria-pressed={isActive}
          >
            {isActive && (
              <motion.span
                layoutId="theme-toggle-active"
                className="absolute inset-0 rounded-full bg-[#0b65e5] shadow-[0_4px_10px_rgba(11,101,229,0.35)] dark:bg-sky-500"
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              />
            )}
            <Icon className={`relative z-10 size-4 ${isActive ? 'text-white' : 'text-[#5a6d88] dark:text-slate-300'}`} />
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;
