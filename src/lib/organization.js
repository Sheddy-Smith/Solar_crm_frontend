import { useEffect, useState } from 'react';
import { settingsApi } from '../api.js';

const EVENT = 'malwa:organization';

const FALLBACK = {
  display_name: 'Company',
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

/** Uploaded company logo path/URL from Settings → Company Profile (empty if none). */
export function organizationLogoUrl() {
  return snapshot?.logo_url || snapshot?.company?.logoUrl || '';
}

export function organizationFinancialYearLabel() {
  const label = snapshot?.financial_year?.label;
  return label ? (String(label).startsWith('FY') ? label : `FY ${label}`) : 'FY —';
}

/**
 * Billing / challan / invoice print shape from Settings → Company Profile.
 * Prefer live org snapshot over hardcoded module fallbacks.
 */
export function crmCompanyProfile(overrides = {}) {
  const company = snapshot?.company || {};
  const business = snapshot?.business || {};
  return {
    companyName: company.companyName || business.businessName || overrides.companyName || organizationDisplayName(),
    shortName: company.shortName || company.companyName || business.businessName || overrides.shortName || '',
    companyType: company.companyType || business.entityType || overrides.companyType || '',
    gstNumber: company.gstNumber || business.gst || snapshot?.gstin || overrides.gstNumber || '',
    panNumber: company.panNumber || business.pan || overrides.panNumber || '',
    tanNumber: company.tanNumber || business.tan || overrides.tanNumber || '',
    cin: company.cin || business.cin || overrides.cin || '',
    phone: company.phone || business.phone || overrides.phone || '',
    secondaryPhone: company.secondaryPhone || overrides.secondaryPhone || '',
    email: company.email || business.email || overrides.email || '',
    altEmail: company.altEmail || overrides.altEmail || '',
    website: company.website || business.website || overrides.website || '',
    address1: company.address1 || business.address1 || overrides.address1 || '',
    address2: company.address2 || business.address2 || overrides.address2 || '',
    city: company.city || business.city || overrides.city || '',
    state: company.state || business.state || overrides.state || '',
    pinCode: company.pinCode || company.pin || business.pin || overrides.pinCode || '',
    country: company.country || business.country || overrides.country || 'India',
    bankName: company.bankName || overrides.bankName || '',
    accountNumber: company.accountNumber || overrides.accountNumber || '',
    ifsc: company.ifsc || overrides.ifsc || '',
    branch: company.branch || overrides.branch || '',
    contactName: company.contactName || overrides.contactName || '',
    designation: company.designation || overrides.designation || '',
    contactPhone: company.contactPhone || company.phone || overrides.contactPhone || '',
    contactEmail: company.contactEmail || company.email || overrides.contactEmail || '',
    notes: company.notes || overrides.notes || '',
    logoUrl: organizationLogoUrl() || overrides.logoUrl || '',
    currency: company.currency || business.currency || overrides.currency || 'INR (Rs)',
    timezone: company.timezone || business.timezone || overrides.timezone || '',
  };
}

export function quotationCompanyFromOrganization(defaults = {}) {
  const company = snapshot?.company || {};
  const business = snapshot?.business || {};
  const profile = crmCompanyProfile();
  const addressParts = [profile.address1, profile.address2, profile.city, profile.state, profile.pinCode]
    .filter(Boolean);
  const phone = [profile.phone, profile.secondaryPhone].filter(Boolean).join(', ');
  const website = String(profile.website || defaults.web || '').replace(/^https?:\/\//, '');
  const logoUrl = organizationLogoUrl() || defaults.logoUrl;
  return {
    ...defaults,
    name: profile.companyName || defaults.name,
    shortName: profile.shortName || profile.companyName || defaults.shortName,
    address: addressParts.join(', ') || defaults.address,
    officeLine: addressParts.length
      ? `OFFICE:- ${[profile.address1, profile.city, profile.state].filter(Boolean).join(', ')}`
      : defaults.officeLine,
    phone: phone || defaults.phone,
    email: profile.email || defaults.email,
    web: website || defaults.web,
    gstin: profile.gstNumber || defaults.gstin,
    bankAccount: profile.accountNumber || defaults.bankAccount,
    bankIfsc: profile.ifsc || defaults.bankIfsc,
    bankName: [profile.bankName, profile.branch].filter(Boolean).join(', ') || defaults.bankName,
    logoUrl: logoUrl || defaults.logoUrl,
  };
}

/** React hook — re-renders when Settings → Company Profile saves (refreshOrganization). */
export function useOrganization() {
  const [org, setOrg] = useState(() => getOrganization());
  useEffect(() => {
    if (!getOrganization()) {
      refreshOrganization().catch(() => refreshBranding().catch(() => {}));
    }
    return subscribeOrganization(setOrg);
  }, []);
  return org;
}

function publishSnapshot(next) {
  snapshot = next && typeof next === 'object' ? next : { ...FALLBACK };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: snapshot }));
  }
  return snapshot;
}

/** Public branding for portal/login (no JWT). Merges into org snapshot. */
export async function refreshBranding({ force = false } = {}) {
  if (!force && snapshot?.logo_url) return snapshot;
  try {
    const data = await settingsApi.branding.get();
    const logo = data?.logo_url || '';
    const name = data?.display_name || FALLBACK.display_name;
    const base = snapshot && typeof snapshot === 'object' ? { ...snapshot } : { ...FALLBACK };
    base.display_name = name || base.display_name;
    // Never wipe a known logo with an empty branding payload.
    base.logo_url = logo || base.logo_url || '';
    if (base.company && typeof base.company === 'object') {
      base.company = {
        ...base.company,
        logoUrl: logo || base.logo_url || base.company.logoUrl || '',
      };
    } else {
      base.company = { logoUrl: base.logo_url || '' };
    }
    return publishSnapshot(base);
  } catch {
    return snapshot || { ...FALLBACK };
  }
}

export async function refreshOrganization({ force = false } = {}) {
  if (snapshot && !force && snapshot.company && Object.keys(snapshot.company).length) return snapshot;
  if (inflight) return inflight;
  inflight = settingsApi.organization.get()
    .then((data) => publishSnapshot(data && typeof data === 'object' ? data : { ...FALLBACK }))
    .catch(async () => {
      // Logged-out portal: fall back to public branding endpoint.
      return refreshBranding({ force: true });
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
