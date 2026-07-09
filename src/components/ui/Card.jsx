import { motion } from 'framer-motion';

const basePanelClass =
  'crm-panel rounded-[12px] border border-[#dbe5f2] bg-white/90 shadow-[0_10px_24px_rgba(24,48,87,0.06)] backdrop-blur-sm ' +
  'dark:border-slate-700 dark:bg-slate-900/70';

/**
 * Shared panel primitive: same visual shell as the existing `panelClass`
 * (kept, so the legacy dark-mode CSS override still applies), plus a
 * fade/slide-in entrance and real `dark:` classes for anything new.
 */
function Card({ children, className = '', title, ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={[basePanelClass, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {title && (
        <h3 className="mb-2.5 text-[20px] font-semibold text-[#163d70] dark:text-slate-100">{title}</h3>
      )}
      {children}
    </motion.div>
  );
}

export default Card;
