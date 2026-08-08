export const LOGISTICS_COMPANIES = ['Valmo', 'Delhivery', 'Ecom Express', 'Xpressbees', 'Shadowfax', 'Other'] as const;

export function supportsHubOperations(company?: string | null) {
  return String(company || '').trim().toLowerCase() === 'valmo';
}
