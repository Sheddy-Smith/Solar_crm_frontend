import { settingsApi } from '../api.js';

const EVENT = 'malwa:organization';

const FALLBACK = {
  display_name: 'Malwa Solar Energy',
  gstin: '',
  company: {},
  business: {},
  financial_year: null,
  branches: [],
};

let snapshot = null;
let inflight = null;

export function getOrganization() {
  return snapshot;
}

export function organizationDisplayName() {
  return snapshot?.display_name || FALLBACK.display_name;
}

export function organizationFinancialYearLabel() {
  const label = snapshot?.financial_year?.label;
  return label ? (String(label).startsWith('FY') ? label : `FY ${label}`) : 'FY —';
}

export function quotationCompanyFromOrganization(defaults) {
  const company = snapshot?.company || {};
  const business = snapshot?.business || {};
  const addressParts = [company.address1, company.address2, company.city, company.state, company.pinCode || company.pin]
    .filter(Boolean);
  const phone = [company.phone, company.secondaryPhone].filter(Boolean).join(', ');
  const website = String(company.website || business.website || defaults.web || '').replace(/^https?:\/\//, '');
  return {
    ...defaults,
    name: company.companyName || business.businessName || defaults.name,
    shortName: company.shortName || company.companyName || business.businessName || defaults.shortName,
    address: addressParts.join(', ') || defaults.address,
    officeLine: addressParts.length
      ? `OFFICE:- ${[company.address1, company.city, company.state].filter(Boolean).join(', ')}`
      : defaults.officeLine,
    phone: phone || business.phone || defaults.phone,
    email: company.email || business.email || defaults.email,
    web: website || defaults.web,
    gstin: company.gstNumber || business.gst || snapshot?.gstin || defaults.gstin,
    bankAccount: company.accountNumber || defaults.bankAccount,
    bankIfsc: company.ifsc || defaults.bankIfsc,
    bankName: [company.bankName, company.branch].filter(Boolean).join(', ') || defaults.bankName,
  };
}

export async function refreshOrganization({ force = false } = {}) {
  if (snapshot && !force) return snapshot;
  if (inflight) return inflight;
  inflight = settingsApi.organization.get()
    .then((data) => {
      snapshot = data && typeof data === 'object' ? data : { ...FALLBACK };
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENT, { detail: snapshot }));
      }
      return snapshot;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function subscribeOrganization(listener) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => listener(event.detail || getOrganization());
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
