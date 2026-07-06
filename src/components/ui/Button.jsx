import { motion } from 'framer-motion';

const sizeClasses = {
  sm: 'px-3 py-1.5 text-[12px]',
  md: 'px-4 py-2.5 text-[13px]',
  lg: 'px-5 py-3 text-[14px]',
};

const variantClasses = {
  primary:
    'bg-[#0b65e5] text-white hover:bg-[#0954c2] focus-visible:ring-[#0b65e5]/40 ' +
    'dark:bg-[#1c7ff0] dark:hover:bg-[#0b65e5]',
  secondary:
    'bg-white text-[#20345f] border border-[#d4d9e7] hover:bg-[#f4f7ff] focus-visible:ring-[#0b65e5]/30 ' +
    'dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700',
  ghost:
    'bg-transparent text-[#0b65e5] hover:bg-[#eaf2ff] focus-visible:ring-[#0b65e5]/20 ' +
    'dark:text-sky-300 dark:hover:bg-slate-800',
  success:
    'bg-[#0d9f4a] text-white hover:bg-[#0b8a3f] focus-visible:ring-[#0d9f4a]/40 ' +
    'dark:bg-[#12b357] dark:hover:bg-[#0d9f4a]',
  danger:
    'bg-[#ea5a4c] text-white hover:bg-[#d94435] focus-visible:ring-[#ea5a4c]/40 ' +
    'dark:bg-[#f0685a] dark:hover:bg-[#ea5a4c]',
};

/**
 * Shared button primitive: consistent variant/size styling + a subtle
 * hover/tap motion, with real `dark:` variants (no attribute-selector CSS
 * override needed) so any panel migrated to this component drops out of
 * the legacy dark-mode retint list in index.css.
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  disabled = false,
  ...rest
}) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -1, scale: 1.02 }}
      whileTap={disabled ? undefined : { y: 0, scale: 0.98 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={[
        'inline-flex items-center justify-center gap-1.5 rounded-[10px] font-bold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        sizeClasses[size] || sizeClasses.md,
        variantClasses[variant] || variantClasses.primary,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export default Button;
