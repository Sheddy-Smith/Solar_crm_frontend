import { FileText } from 'lucide-react';
import { MobileCardEmpty, MobileCardList, MobileRecordCard } from './MobileRecordCard.jsx';

function defaultMoney(v) {
  const n = Number(v || 0);
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function drCr(value, fmtMoney) {
  const n = Number(value || 0);
  return `${fmtMoney(Math.abs(n))} (${n >= 0 ? 'Dr' : 'Cr'})`;
}

/** Phone-only ledger entry cards with a totals footer; pair with a `hidden lg:block` ledger table. */
export function LedgerMobileCards({
  entries,
  emptyText,
  totalDebit,
  totalCredit,
  finalBalance,
  onOpen,
  TypeBadge,
  fmtDate = (v) => v || '—',
  fmtMoney = defaultMoney,
}) {
  if (!entries.length) return <MobileCardEmpty title={emptyText} />;
  const isCredit = Number(finalBalance) < 0;
  return (
    <MobileCardList>
      {entries.map((e, i) => {
        const type = e.type_label || e.type;
        return (
          <MobileRecordCard
            key={`${e.ref}-${i}`}
            icon={FileText}
            title={e.work || e.particulars || type || '—'}
            subtitle={[fmtDate(e.date), e.ref].filter(Boolean).join(' · ')}
            aside={drCr(e.balance, fmtMoney)}
            badges={TypeBadge ? <TypeBadge value={type} /> : null}
            details={[
              { label: 'Debit', value: e.debit ? fmtMoney(e.debit) : '—', tone: e.debit ? 'danger' : undefined },
              { label: 'Credit', value: e.credit ? fmtMoney(e.credit) : '—', tone: e.credit ? 'success' : undefined },
              e.category ? { label: 'Category', value: e.category } : null,
              e.vehicle_no ? { label: 'Vehicle No', value: e.vehicle_no } : null,
            ]}
            onOpen={onOpen ? () => onOpen(e) : undefined}
          />
        );
      })}
      <div className="grid grid-cols-3 gap-2 rounded-[14px] border border-[#cbd5e1] bg-[#f8fafc] p-3 text-center">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#8a98af]">Debit</p>
          <p className="mt-0.5 break-words text-[12px] font-extrabold text-[#dc2626]">{fmtMoney(totalDebit)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#8a98af]">Credit</p>
          <p className="mt-0.5 break-words text-[12px] font-extrabold text-[#16a34a]">{fmtMoney(totalCredit)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#8a98af]">Balance</p>
          <p className={`mt-0.5 break-words text-[12px] font-extrabold ${isCredit ? 'text-[#166534]' : 'text-[#dc2626]'}`}>
            {drCr(finalBalance, fmtMoney)}
          </p>
        </div>
      </div>
    </MobileCardList>
  );
}
