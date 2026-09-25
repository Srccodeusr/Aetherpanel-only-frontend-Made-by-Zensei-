/**
 * Every page the Admin → Page Designer can target, grouped the way they're
 * shown in the page picker. `key` must match the `currentPage` route key
 * used in App.tsx / routing.ts.
 */
export interface PageRegistryEntry {
  key: string;
  label: string;
}

export interface PageRegistryGroup {
  group: string;
  pages: PageRegistryEntry[];
}

export const CUSTOM_PAGE_REGISTRY: PageRegistryGroup[] = [
  {
    group: 'Public Site',
    pages: [
      { key: 'home', label: 'Home' },
      { key: 'minecraft', label: 'Minecraft Hosting' },
      { key: 'bot', label: 'Bot Hosting' },
      { key: 'pricing', label: 'Browse Plans (Pricing)' },
      { key: 'status', label: 'Status' },
      { key: 'docs', label: 'Docs' },
      { key: 'terms', label: 'Terms of Service' },
      { key: 'privacy', label: 'Privacy Policy' },
      { key: 'acceptable-use', label: 'Acceptable Use Policy' }
    ]
  },
  {
    group: 'Auth',
    pages: [
      { key: 'login', label: 'Login' },
      { key: 'register', label: 'Register' }
    ]
  },
  {
    group: 'Customer Account',
    pages: [
      { key: 'dashboard', label: 'Dashboard (Home)' },
      { key: 'billing', label: 'Billing' },
      { key: 'checkout', label: 'Checkout' },
      { key: 'support', label: 'Support Tickets' },
      { key: 'mail', label: 'Mail' },
      { key: 'activity', label: 'Activity Log' },
      { key: 'settings', label: 'Account Settings' }
    ]
  },
  {
    group: 'Admin Panel',
    pages: [
      { key: 'admin-dashboard', label: 'System Overview' },
      { key: 'admin-users', label: 'User Accounts' },
      { key: 'admin-products', label: 'Products & Plans' },
      { key: 'admin-billing', label: 'Orders & Billing' },
      { key: 'admin-coupons', label: 'Coupons' },
      { key: 'admin-announcements', label: 'Announcements' },
      { key: 'admin-ads', label: 'Ad Campaigns' },
      { key: 'admin-discord', label: 'Discord Integration' },
      { key: 'admin-appearance', label: 'Fonts & Themes' },
      { key: 'admin-support', label: 'Support Queue' },
      { key: 'admin-mail', label: 'Mail Center' },
      { key: 'admin-audit-logs', label: 'Audit Trail' },
      { key: 'admin-api-keys', label: 'REST API Keys' },
      { key: 'admin-legal', label: 'Legal & Policies' },
      { key: 'admin-settings', label: 'Platform Settings' },
      { key: 'admin-panel-link', label: 'Panel Integration' }
    ]
  }
];

export function findPageLabel(pageKey: string): string {
  for (const g of CUSTOM_PAGE_REGISTRY) {
    const found = g.pages.find(p => p.key === pageKey);
    if (found) return found.label;
  }
  return pageKey;
}
