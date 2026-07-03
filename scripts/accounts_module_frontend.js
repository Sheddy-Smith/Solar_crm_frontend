// ── Accounts (simplified popup-based module) ──────────────────────────────────

const ACC_PAYMENT_MODES = ['Cash', 'Cheque', 'NEFT', 'RTGS', 'UPI', 'IMPS', 'Transfer', 'Other'];
const fmtAccRs = (v) => (v != null && v !== '' ? `Rs ${Number(v).toLocaleString('en-IN')}` : '—');

function AccountsPage({ activeSection, onOpenSection, onNotify }) {
  if (activeSection === 'Accounts List') {
    return <AccountsPartiesPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Transactions List') {
    return <AccountsTransactionsPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Chart of Accounts') {
    return <AccountsChartPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Payment Received') {
    return <AccountsPaymentReceivedPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Payment Made') {
    return <AccountsPaymentMadePage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Bank Accounts') {
    return <AccountsBankPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Cheques List') {
    return <AccountsChequesPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  return <AccountsPartiesPage activeSection="Accounts List" onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function AccountsPartiesPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'Accounts',
    Subnav: AccountsSubnavTabs,
    title: 'Accounts List',
    recordLabel: 'Account',
    newLabel: 'Add Account',
    api: accountsModuleApi.parties,
    statuses: ['Active', 'Inactive', 'Pending'],
    extraFilters: [{ key: 'account_type', label: 'All Types', options: ['Customer', 'Vendor', 'Partner'] }],
    searchKeys: ['name', 'contact_person', 'phone', 'email', 'city'],
    columns: [
      { label: 'Code', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.record_no}</span> },
      { label: 'Name', render: (r) => <span className="font-semibold text-[#1e2a38]">{r.name}</span> },
      { label: 'Type', render: (r) => r.account_type },
      { label: 'Contact', render: (r) => r.contact_person || r.phone || '—' },
      { label: 'City', render: (r) => r.city || '—' },
      { label: 'Balance', render: (r) => fmtAccRs(r.balance) },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.status} /> },
    ],
    fields: [
      { name: 'name', label: 'Account Name', type: 'text', required: true },
      { name: 'account_type', label: 'Type', type: 'select', options: ['Customer', 'Vendor', 'Partner'] },
      { name: 'contact_person', label: 'Contact Person', type: 'text' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'city', label: 'City', type: 'text' },
      { name: 'balance', label: 'Opening Balance (Rs)', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Pending'] },
      { name: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
    defaults: { name: '', account_type: 'Customer', contact_person: '', phone: '', email: '', city: '', balance: '', status: 'Active', remarks: '' },
    detailRows: [
      ['Account Name', (r) => r.name],
      ['Type', (r) => r.account_type],
      ['Contact Person', (r) => r.contact_person || '—'],
      ['Phone', (r) => r.phone || '—'],
      ['Email', (r) => r.email || '—'],
      ['City', (r) => r.city || '—'],
      ['Balance', (r) => fmtAccRs(r.balance)],
      ['Remarks', (r) => r.remarks || '—'],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function AccountsTransactionsPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'Accounts',
    Subnav: AccountsSubnavTabs,
    title: 'Transactions',
    recordLabel: 'Transaction',
    newLabel: 'New Transaction',
    api: accountsModuleApi.transactions,
    statuses: ['Pending', 'Completed'],
    extraFilters: [{ key: 'transaction_type', label: 'All Types', options: ['Payment Received', 'Payment Made', 'Journal Entry'] }],
    searchKeys: ['reference_number', 'description', 'party_name'],
    lookups: {
      parties: { api: accountsModuleApi.parties, label: (a) => a.name },
      banks: { api: accountsModuleApi.bankAccounts, label: (b) => b.account_name },
    },
    columns: [
      { label: 'Ref No', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.record_no}</span> },
      { label: 'Date', render: (r) => lcFormatDate(r.transaction_date) },
      { label: 'Type', render: (r) => r.transaction_type },
      { label: 'Party', render: (r) => r.party_name || '—' },
      { label: 'Amount', render: (r) => fmtAccRs(r.amount) },
      { label: 'Mode', render: (r) => r.payment_mode || '—' },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.status} /> },
    ],
    fields: [
      { name: 'transaction_date', label: 'Date', type: 'date', required: true },
      { name: 'transaction_type', label: 'Type', type: 'select', options: ['Payment Received', 'Payment Made', 'Journal Entry'] },
      { name: 'reference_number', label: 'Reference No', type: 'text' },
      { name: 'party', label: 'Party', type: 'lookup', lookup: 'parties' },
      { name: 'bank_account', label: 'Bank Account', type: 'lookup', lookup: 'banks' },
      { name: 'payment_mode', label: 'Payment Mode', type: 'select', options: ACC_PAYMENT_MODES },
      { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true },
      { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Completed'] },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
    defaults: { transaction_date: '', transaction_type: 'Payment Received', reference_number: '', party: '', bank_account: '', payment_mode: 'NEFT', amount: '', status: 'Completed', description: '' },
    detailRows: [
      ['Date', (r) => lcFormatDate(r.transaction_date)],
      ['Type', (r) => r.transaction_type],
      ['Reference', (r) => r.reference_number || r.record_no],
      ['Party', (r) => r.party_name || '—'],
      ['Bank', (r) => r.bank_account_name || '—'],
      ['Amount', (r) => fmtAccRs(r.amount)],
      ['Payment Mode', (r) => r.payment_mode || '—'],
      ['Description', (r) => r.description || '—', true],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function AccountsChartPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'Accounts',
    Subnav: AccountsSubnavTabs,
    title: 'Chart of Accounts',
    recordLabel: 'Ledger Account',
    newLabel: 'Add Ledger',
    api: accountsModuleApi.chartOfAccounts,
    statuses: [],
    extraFilters: [{ key: 'account_type', label: 'All Types', options: ['Asset', 'Liability', 'Income', 'Expense', 'Equity'] }],
    searchKeys: ['account_code', 'account_name'],
    lookups: { parents: { api: accountsModuleApi.chartOfAccounts, label: (a) => `${a.account_code} — ${a.account_name}` } },
    columns: [
      { label: 'Code', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.account_code}</span> },
      { label: 'Account Name', render: (r) => <span className="font-semibold text-[#1e2a38]">{r.account_name}</span> },
      { label: 'Type', render: (r) => r.account_type },
      { label: 'Parent', render: (r) => r.parent_name || '—' },
      { label: 'Opening Bal.', render: (r) => fmtAccRs(r.opening_balance) },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.status} /> },
    ],
    fields: [
      { name: 'account_code', label: 'Account Code', type: 'text', required: true },
      { name: 'account_name', label: 'Account Name', type: 'text', required: true },
      { name: 'account_type', label: 'Account Type', type: 'select', options: ['Asset', 'Liability', 'Income', 'Expense', 'Equity'] },
      { name: 'parent', label: 'Parent Account', type: 'lookup', lookup: 'parents' },
      { name: 'opening_balance', label: 'Opening Balance (Rs)', type: 'number' },
      { name: 'is_active', label: 'Status', type: 'activeFlag' },
    ],
    defaults: { account_code: '', account_name: '', account_type: 'Asset', parent: '', opening_balance: '', is_active: 'Active' },
    detailRows: [
      ['Account Code', (r) => r.account_code],
      ['Account Name', (r) => r.account_name],
      ['Type', (r) => r.account_type],
      ['Parent', (r) => r.parent_name || '—'],
      ['Opening Balance', (r) => fmtAccRs(r.opening_balance)],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function AccountsPaymentReceivedPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'Accounts',
    Subnav: AccountsSubnavTabs,
    title: 'Payment Received',
    recordLabel: 'Receipt',
    newLabel: 'Record Receipt',
    api: accountsModuleApi.payments,
    listParams: { direction: 'Received' },
    fixedFields: { direction: 'Received' },
    statuses: ['Pending', 'Completed', 'Cancelled'],
    searchKeys: ['reference_no', 'party_name', 'project_ref'],
    lookups: {
      parties: { api: accountsModuleApi.parties, label: (a) => a.name },
      banks: { api: accountsModuleApi.bankAccounts, label: (b) => b.account_name },
    },
    columns: [
      { label: 'Receipt No', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.record_no}</span> },
      { label: 'Date', render: (r) => lcFormatDate(r.payment_date) },
      { label: 'Customer', render: (r) => r.party_display },
      { label: 'Mode', render: (r) => r.payment_mode },
      { label: 'Amount', render: (r) => fmtAccRs(r.amount) },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.status} /> },
    ],
    fields: [
      { name: 'reference_no', label: 'Receipt No', type: 'text' },
      { name: 'payment_date', label: 'Date', type: 'date', required: true },
      { name: 'party', label: 'Customer', type: 'lookup', lookup: 'parties' },
      { name: 'party_name', label: 'Or Customer Name', type: 'text' },
      { name: 'bank_account', label: 'Deposit To', type: 'lookup', lookup: 'banks' },
      { name: 'payment_mode', label: 'Payment Mode', type: 'select', options: ACC_PAYMENT_MODES },
      { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true },
      { name: 'project_ref', label: 'Invoice / Project Ref', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Completed', 'Cancelled'] },
      { name: 'description', label: 'Notes', type: 'textarea' },
    ],
    defaults: { reference_no: '', payment_date: '', party: '', party_name: '', bank_account: '', payment_mode: 'NEFT', amount: '', project_ref: '', status: 'Completed', description: '' },
    detailRows: [
      ['Receipt No', (r) => r.record_no],
      ['Date', (r) => lcFormatDate(r.payment_date)],
      ['Customer', (r) => r.party_display],
      ['Bank Account', (r) => r.bank_account_name || '—'],
      ['Payment Mode', (r) => r.payment_mode],
      ['Amount', (r) => fmtAccRs(r.amount)],
      ['Project Ref', (r) => r.project_ref || '—'],
      ['Notes', (r) => r.description || '—', true],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function AccountsPaymentMadePage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'Accounts',
    Subnav: AccountsSubnavTabs,
    title: 'Payment Made',
    recordLabel: 'Payment',
    newLabel: 'Record Payment',
    api: accountsModuleApi.payments,
    listParams: { direction: 'Made' },
    fixedFields: { direction: 'Made' },
    statuses: ['Pending', 'Completed', 'Cancelled'],
    searchKeys: ['reference_no', 'party_name', 'project_ref'],
    lookups: {
      parties: { api: accountsModuleApi.parties, label: (a) => a.name },
      banks: { api: accountsModuleApi.bankAccounts, label: (b) => b.account_name },
    },
    columns: [
      { label: 'Payment No', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.record_no}</span> },
      { label: 'Date', render: (r) => lcFormatDate(r.payment_date) },
      { label: 'Payee', render: (r) => r.party_display },
      { label: 'Mode', render: (r) => r.payment_mode },
      { label: 'Amount', render: (r) => fmtAccRs(r.amount) },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.status} /> },
    ],
    fields: [
      { name: 'reference_no', label: 'Payment No', type: 'text' },
      { name: 'payment_date', label: 'Date', type: 'date', required: true },
      { name: 'party', label: 'Payee', type: 'lookup', lookup: 'parties' },
      { name: 'party_name', label: 'Or Payee Name', type: 'text' },
      { name: 'bank_account', label: 'Pay From', type: 'lookup', lookup: 'banks' },
      { name: 'payment_mode', label: 'Payment Mode', type: 'select', options: ACC_PAYMENT_MODES },
      { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true },
      { name: 'project_ref', label: 'Bill / Ref No', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Completed', 'Cancelled'] },
      { name: 'description', label: 'Notes', type: 'textarea' },
    ],
    defaults: { reference_no: '', payment_date: '', party: '', party_name: '', bank_account: '', payment_mode: 'NEFT', amount: '', project_ref: '', status: 'Completed', description: '' },
    detailRows: [
      ['Payment No', (r) => r.record_no],
      ['Date', (r) => lcFormatDate(r.payment_date)],
      ['Payee', (r) => r.party_display],
      ['Bank Account', (r) => r.bank_account_name || '—'],
      ['Payment Mode', (r) => r.payment_mode],
      ['Amount', (r) => fmtAccRs(r.amount)],
      ['Bill Ref', (r) => r.project_ref || '—'],
      ['Notes', (r) => r.description || '—', true],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function AccountsBankPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'Accounts',
    Subnav: AccountsSubnavTabs,
    title: 'Bank Accounts',
    recordLabel: 'Bank Account',
    newLabel: 'Add Bank Account',
    api: accountsModuleApi.bankAccounts,
    statuses: ['Active', 'Inactive'],
    searchKeys: ['account_name', 'bank_name', 'account_number', 'ifsc'],
    columns: [
      { label: 'Account', render: (r) => <span className="font-semibold text-[#1e2a38]">{r.account_name}</span> },
      { label: 'Bank', render: (r) => r.bank_name },
      { label: 'A/C No', render: (r) => r.account_number },
      { label: 'IFSC', render: (r) => r.ifsc || '—' },
      { label: 'Balance', render: (r) => fmtAccRs(r.balance) },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.status} /> },
    ],
    fields: [
      { name: 'account_name', label: 'Account Name', type: 'text', required: true },
      { name: 'bank_name', label: 'Bank Name', type: 'text', required: true },
      { name: 'account_number', label: 'Account Number', type: 'text', required: true },
      { name: 'ifsc', label: 'IFSC', type: 'text' },
      { name: 'account_type', label: 'Account Type', type: 'select', options: ['Current Account', 'Savings Account', 'OD Account', 'Cash Credit'] },
      { name: 'branch', label: 'Branch', type: 'text' },
      { name: 'balance', label: 'Current Balance (Rs)', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
      { name: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
    defaults: { account_name: '', bank_name: '', account_number: '', ifsc: '', account_type: 'Current Account', branch: '', balance: '', status: 'Active', remarks: '' },
    detailRows: [
      ['Account Name', (r) => r.account_name],
      ['Bank', (r) => r.bank_name],
      ['Account Number', (r) => r.account_number],
      ['IFSC', (r) => r.ifsc || '—'],
      ['Branch', (r) => r.branch || '—'],
      ['Balance', (r) => fmtAccRs(r.balance)],
      ['Remarks', (r) => r.remarks || '—'],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function AccountsChequesPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'Accounts',
    Subnav: AccountsSubnavTabs,
    title: 'Cheques',
    recordLabel: 'Cheque',
    newLabel: 'Add Cheque',
    api: accountsModuleApi.cheques,
    statuses: ['Issued', 'Pending', 'Deposited', 'Cleared', 'Cancelled'],
    extraFilters: [{ key: 'cheque_type', label: 'All Types', options: ['Issued', 'Received'] }],
    searchKeys: ['cheque_no', 'payee_name'],
    lookups: { banks: { api: accountsModuleApi.bankAccounts, label: (b) => b.account_name } },
    columns: [
      { label: 'Cheque No', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.cheque_no}</span> },
      { label: 'Date', render: (r) => lcFormatDate(r.cheque_date) },
      { label: 'Payee', render: (r) => r.payee_name },
      { label: 'Bank', render: (r) => r.bank_account_name || '—' },
      { label: 'Amount', render: (r) => fmtAccRs(r.amount) },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.status} /> },
    ],
    fields: [
      { name: 'cheque_no', label: 'Cheque No', type: 'text', required: true },
      { name: 'cheque_date', label: 'Date', type: 'date', required: true },
      { name: 'bank_account', label: 'Bank Account', type: 'lookup', lookup: 'banks' },
      { name: 'payee_name', label: 'Payee Name', type: 'text', required: true },
      { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true },
      { name: 'cheque_type', label: 'Type', type: 'select', options: ['Issued', 'Received'] },
      { name: 'status', label: 'Status', type: 'select', options: ['Issued', 'Pending', 'Deposited', 'Cleared', 'Cancelled'] },
      { name: 'cleared_date', label: 'Cleared Date', type: 'date' },
      { name: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
    defaults: { cheque_no: '', cheque_date: '', bank_account: '', payee_name: '', amount: '', cheque_type: 'Issued', status: 'Issued', cleared_date: '', remarks: '' },
    detailRows: [
      ['Cheque No', (r) => r.cheque_no],
      ['Date', (r) => lcFormatDate(r.cheque_date)],
      ['Payee', (r) => r.payee_name],
      ['Bank', (r) => r.bank_account_name || '—'],
      ['Amount', (r) => fmtAccRs(r.amount)],
      ['Type', (r) => r.cheque_type],
      ['Cleared Date', (r) => lcFormatDate(r.cleared_date)],
      ['Remarks', (r) => r.remarks || '—'],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}
