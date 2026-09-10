import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { getInstallationId } from './installation';
import {
  User, Product, Plan, Order, Coupon,
  SupportTicket, Announcement, AuditLog, SystemSettings,
  AdItem, AdEvent,
  DiscordAccount, DiscordAuditLog,
  ApiKey, ApiAuditLog, WebhookSubscription, LegalPage,
  StatusComponent, Incident, ScheduledMaintenance,
  ProvisionRecord, PanelIntegrationSettings
} from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export interface DatabaseSchema {
  installationId?: string;
  users: User[];
  passwords: Record<string, string>; // userId -> passwordHash
  products: Product[];
  plans: Plan[];
  orders: Order[];
  coupons: Coupon[];
  tickets: SupportTicket[];
  announcements: Announcement[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
  ads: AdItem[];
  adEvents: AdEvent[];
  discordLinks: Record<string, DiscordAccount>;
  discordAuditLogs: DiscordAuditLog[];
  apiKeys: ApiKey[];
  apiAuditLogs: ApiAuditLog[];
  webhooks: WebhookSubscription[];
  legalPages: LegalPage[];
  statusComponents: StatusComponent[];
  incidents: Incident[];
  scheduledMaintenances: ScheduledMaintenance[];
  provisions: ProvisionRecord[];
}

const defaultProducts: Product[] = [
  {
    id: 'prod_minecraft',
    slug: 'minecraft',
    name: 'Minecraft Hosting',
    description: 'High-performance Minecraft server hosting powered by high clock-speed AMD Ryzen CPU nodes and NVMe SSDs.',
    category: 'minecraft',
    icon: 'Gamepad2',
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'prod_bot',
    slug: 'bot',
    name: 'Discord Bot Hosting',
    description: '24/7 persistent process hosting for Discord, Telegram, and Twitch bots supporting Node.js, Python, and Bun.',
    category: 'bot',
    icon: 'Bot',
    isActive: true,
    sortOrder: 2
  }
];

const defaultPlans: Plan[] = [
  {
    id: 'plan_mc_free', productId: 'prod_minecraft', name: 'Free Tier',
    description: 'Free plan for testing, small survival worlds, and plugins.',
    priceMonthly: 0, priceYearly: 0, ramMB: 1024, cpuCores: 1, diskGB: 10,
    backupLimit: 1, databaseLimit: 1, serverLimit: 1, networkMbps: 1000,
    features: ['1GB DDR5 RAM', '1 vCPU Ryzen 9', '10GB NVMe Storage', 'Subdomain Included', 'Free Forever'],
    locations: ['local'], isActive: true
  },
  {
    id: 'plan_mc_starter', productId: 'prod_minecraft', name: 'Starter Tier',
    description: 'Ideal for small friend groups & vanilla survival worlds.',
    priceMonthly: 19, priceYearly: 190, ramMB: 2048, cpuCores: 1.5, diskGB: 20,
    backupLimit: 2, databaseLimit: 1, serverLimit: 1, networkMbps: 1000,
    features: ['2GB DDR5 RAM', '1.5 vCPU Ryzen 9', '20GB NVMe Storage', 'Subdomain Included', '2 Backups'],
    locations: ['local'], isActive: true
  },
  {
    id: 'plan_mc_basic', productId: 'prod_minecraft', name: 'Basic Tier',
    description: 'Great for small community servers & light plugin setups.',
    priceMonthly: 39, priceYearly: 390, ramMB: 3072, cpuCores: 2, diskGB: 30,
    backupLimit: 3, databaseLimit: 2, serverLimit: 2, networkMbps: 1000,
    features: ['3GB DDR5 RAM', '2 vCPU Ryzen 9', '30GB NVMe Storage', 'Custom Subdomain', '3 Backups', '2 MySQL DBs'],
    locations: ['local'], isActive: true
  },
  {
    id: 'plan_mc_pro', productId: 'prod_minecraft', name: 'Pro Tier',
    description: 'Recommended for heavily modded servers, Paper, and Purpur networks.',
    priceMonthly: 69, priceYearly: 690, ramMB: 4096, cpuCores: 3, diskGB: 50,
    backupLimit: 5, databaseLimit: 3, serverLimit: 3, networkMbps: 2500,
    features: ['4GB DDR5 RAM', '3 vCPU Ryzen 9', '50GB NVMe Storage', 'DDoS Protection', '5 Backups', '3 MySQL DBs'],
    locations: ['local'], isPopular: true, isActive: true
  },
  {
    id: 'plan_mc_advanced', productId: 'prod_minecraft', name: 'Advanced Network',
    description: 'Maximum performance for large networks and Forge/Fabric modpacks.',
    priceMonthly: 99, priceYearly: 990, ramMB: 6144, cpuCores: 4, diskGB: 75,
    backupLimit: 10, databaseLimit: 5, serverLimit: 5, networkMbps: 10000,
    features: ['6GB DDR5 RAM', '4 vCPU Ryzen 9', '75GB NVMe Storage', '10 Backups', '5 MySQL DBs', 'VIP Support'],
    locations: ['local'], isActive: true
  },
  {
    id: 'plan_bot_free', productId: 'prod_bot', name: 'Free Bot Tier',
    description: 'Free 24/7 process hosting for Discord, Telegram, and Twitch bots.',
    priceMonthly: 0, priceYearly: 0, ramMB: 512, cpuCores: 0.5, diskGB: 5,
    backupLimit: 1, databaseLimit: 1, serverLimit: 1, networkMbps: 1000,
    features: ['512MB RAM', '0.5 vCPU', '5GB Storage', 'Node.js & Python 3', '24/7 Process Manager'],
    locations: ['local'], isActive: true
  },
  {
    id: 'plan_bot_starter', productId: 'prod_bot', name: 'Bot Starter',
    description: 'Perfect for single-sharded Discord bots.',
    priceMonthly: 9, priceYearly: 90, ramMB: 1024, cpuCores: 0.75, diskGB: 10,
    backupLimit: 1, databaseLimit: 1, serverLimit: 1, networkMbps: 1000,
    features: ['1GB RAM', '0.75 vCPU', '10GB Storage', 'Node.js & Python', '24/7 Auto-restart'],
    locations: ['local'], isActive: true
  },
  {
    id: 'plan_bot_basic', productId: 'prod_bot', name: 'Bot Basic',
    description: 'Great for multi-function moderation and music bots.',
    priceMonthly: 19, priceYearly: 190, ramMB: 2048, cpuCores: 1, diskGB: 20,
    backupLimit: 2, databaseLimit: 1, serverLimit: 2, networkMbps: 1000,
    features: ['2GB RAM', '1 vCPU', '20GB Storage', 'Node.js, Python, Bun', '2 Backups'],
    locations: ['local'], isActive: true
  },
  {
    id: 'plan_bot_pro', productId: 'prod_bot', name: 'Bot Pro',
    description: 'For high-traffic, multi-server bots and database-backed bots.',
    priceMonthly: 39, priceYearly: 390, ramMB: 4096, cpuCores: 2, diskGB: 40,
    backupLimit: 3, databaseLimit: 2, serverLimit: 3, networkMbps: 1000,
    features: ['4GB RAM', '2 vCPU', '40GB Storage', 'Node.js, Python, Bun', '3 Backups', '2 Databases'],
    locations: ['local'], isPopular: true, isActive: true
  },
  {
    id: 'plan_bot_advanced', productId: 'prod_bot', name: 'Bot Advanced',
    description: 'Enterprise tier for large Discord bot networks.',
    priceMonthly: 69, priceYearly: 690, ramMB: 6144, cpuCores: 3, diskGB: 60,
    backupLimit: 5, databaseLimit: 3, serverLimit: 5, networkMbps: 2500,
    features: ['6GB RAM', '3 vCPU', '60GB Storage', 'Node.js, Python, Bun', '5 Backups', '3 Databases', 'Priority Support'],
    locations: ['local'], isActive: true
  }
];

const defaultSettings: SystemSettings = {
  platformName: 'AetherPanel',
  brandName: 'AetherPanel',
  brandTagline: 'Next-Generation Cloud Platform for Minecraft & Bot Infrastructure',
  supportEmail: 'support@aetherpanel.com',
  discordUrl: 'https://discord.gg/aetherpanel',
  currencySymbol: '$',
  currencyCode: 'USD',
  registrationEnabled: true,
  emailVerificationRequired: false,
  maintenanceMode: false,
  maintenanceMessage: 'AetherPanel is currently performing scheduled system upgrades. We will be back online shortly.',
  defaultTheme: 'dark',
  accentColor: '#8b5cf6',
  paymentGateways: {
    upi: {
      enabled: true,
      upiId: 'aetherpay@upi',
      merchantName: 'AetherPanel Hosting',
      qrCodeUrl: '',
      instructions: 'Scan the QR code or send payment to the UPI ID. Enter the 12-digit UTR or Transaction Ref ID after payment.'
    },
    bank: {
      enabled: true,
      bankName: '',
      accountNumber: '',
      ifsc: '',
      accountHolder: '',
      instructions: 'Transfer to Bank Account and submit your NEFT/IMPS/Wire Reference Number.'
    },
    crypto: {
      enabled: false,
      walletAddress: '',
      network: 'USDT (TRC20 / ERC20)',
      instructions: 'Send USDT to the wallet address and submit TX Hash.'
    },
    stripe: {
      enabled: false,
      instructions: 'Instant automatic payment via Credit/Debit Card or Wallet.'
    }
  },
  discordSettings: {
    enabled: false,
    botToken: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    defaultWebhookUrl: '',
    botStatus: 'offline',
    commandRateLimitPerMin: 10,
    defaultNotificationEvents: ['PLAN_EXPIRING']
  },
  authProviders: {
    emailPassword: { enabled: true },
    google: { enabled: false, firebaseApiKey: '', firebaseAuthDomain: '', firebaseProjectId: '', firebaseStorageBucket: '', firebaseMessagingSenderId: '', firebaseAppId: '' },
    discord: { enabled: false, clientId: '', clientSecret: '', redirectUri: '' }
  },
  themeSettings: {
    activeThemeId: 'golden',
    activeFontId: 'Plus Jakarta Sans',
    cardStyle: 'rounded-2xl',
    glowIntensity: 'vibrant',
    allowUserCustomization: true,
    assets: { logoUrl: '', faviconUrl: '', bgPatternUrl: '', bannerUrl: '', loginBgUrl: '' }
  },
  antiAbuse: {
    enabled: false,
    provider: 'proxycheck',
    apiKey: '',
    blockVpn: false,
    blockProxy: false,
    blockTor: false,
    blockDatacenter: false,
    maxRiskScore: 75,
    maxRegistrationsPerIpPerDay: 5,
    loginLockoutMaxAttempts: 5,
    loginLockoutDurationSec: 900
  },
  socialLinks: { discord: '', twitter: '', github: '' },
  heroDescription: '',
  footerDescription: '',
  panelIntegration: {
    enabled: false,
    panelUrl: '',
    apiKey: '',
    defaultLocationIds: [],
    autoCreateAccount: true,
    autoCreateServer: true,
    startServerOnCompletion: true
  }
};

const defaultPanelIntegration: PanelIntegrationSettings = {
  enabled: false,
  panelUrl: '',
  apiKey: '',
  defaultLocationIds: [],
  autoCreateAccount: true,
  autoCreateServer: true,
  startServerOnCompletion: true
};

const defaultStatusComponents: StatusComponent[] = [
  {
    id: 'comp_panel', name: 'Website & Customer Portal', type: 'panel',
    description: 'Public website, account dashboard, and billing portal',
    group: 'Core Platform', status: 'operational', uptimePercent90Days: 99.98,
    lastCheckedAt: new Date().toISOString(), order: 1, isPublic: true
  },
  {
    id: 'comp_api', name: 'API', type: 'api',
    description: 'REST API gateway used by the website and integrations',
    group: 'Core Platform', status: 'operational', uptimePercent90Days: 99.97,
    lastCheckedAt: new Date().toISOString(), order: 2, isPublic: true
  },
  {
    id: 'comp_database', name: 'Database', type: 'database',
    description: 'Primary data store for accounts, orders, and settings',
    group: 'Core Platform', status: 'operational', uptimePercent90Days: 99.99,
    lastCheckedAt: new Date().toISOString(), order: 3, isPublic: true
  },
  {
    id: 'comp_payments', name: 'Payment Processing', type: 'custom',
    description: 'Billing, checkout, and payment gateway integrations',
    group: 'External Integrations', status: 'operational', uptimePercent90Days: 99.95,
    lastCheckedAt: new Date().toISOString(), order: 4, isPublic: true
  },
  {
    id: 'comp_discord', name: 'Discord Integration', type: 'discord',
    description: 'Account linking and notification delivery via Discord',
    group: 'External Integrations', status: 'operational', uptimePercent90Days: 99.9,
    lastCheckedAt: new Date().toISOString(), order: 5, isPublic: true
  },
  {
    id: 'comp_support', name: 'Support Desk', type: 'custom',
    description: 'Ticketing system for customer support requests',
    group: 'Core Platform', status: 'operational', uptimePercent90Days: 99.96,
    lastCheckedAt: new Date().toISOString(), order: 6, isPublic: true
  }
];

let dbCache: DatabaseSchema | null = null;
let initPromise: Promise<DatabaseSchema> | null = null;
let saveTimeout: NodeJS.Timeout | null = null;

function defaultDb(): DatabaseSchema {
  return {
    installationId: getInstallationId(),
    users: [],
    passwords: {},
    products: defaultProducts,
    plans: defaultPlans,
    orders: [],
    coupons: [],
    tickets: [],
    announcements: [],
    auditLogs: [],
    settings: defaultSettings,
    ads: [],
    adEvents: [],
    discordLinks: {},
    discordAuditLogs: [],
    apiKeys: [],
    apiAuditLogs: [],
    webhooks: [],
    legalPages: [],
    statusComponents: defaultStatusComponents,
    incidents: [],
    scheduledMaintenances: [],
    provisions: []
  };
}

export async function getDb(reload = false): Promise<DatabaseSchema> {
  if (reload) {
    dbCache = null;
    initPromise = null;
  }

  if (dbCache) return dbCache;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      const adminEmail = process.env.AETHER_ADMIN_EMAIL || 'admin@yourdomain.com';
      const adminPassword = process.env.AETHER_ADMIN_PASSWORD || 'adminopp';

      if (fs.existsSync(DB_FILE)) {
        try {
          const raw = fs.readFileSync(DB_FILE, 'utf-8');
          dbCache = JSON.parse(raw);
        } catch (readErr: any) {
          console.error(`[Database/CRITICAL] Could not parse ${DB_FILE}: ${readErr.message}`);

          const corruptedBackupPath = `${DB_FILE}.corrupted.${Date.now()}`;
          try {
            fs.renameSync(DB_FILE, corruptedBackupPath);
            console.warn(`[Database/INFO] Corrupted database moved to ${corruptedBackupPath}`);
          } catch (renameErr) {
            console.error('[Database/ERROR] Failed to move corrupted database:', renameErr);
          }

          const snapshotPath = path.join(DATA_DIR, 'backups', 'db-snapshot.json');
          if (fs.existsSync(snapshotPath)) {
            try {
              console.log(`[Database/RECOVERY] Attempting recovery from latest snapshot: ${snapshotPath}...`);
              const rawSnapshot = fs.readFileSync(snapshotPath, 'utf-8');
              dbCache = JSON.parse(rawSnapshot);
              console.log('[Database/SUCCESS] Recovered database state from snapshot successfully!');
              fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
            } catch (snapshotErr: any) {
              console.error(`[Database/ERROR] Snapshot recovery failed: ${snapshotErr.message}`);
              dbCache = null;
            }
          } else {
            console.warn('[Database/WARN] No database snapshot found to recover from.');
            dbCache = null;
          }
        }
      }

      if (dbCache) {
        // Backfill defaults for fields that may be missing from an older/imported DB
        if (!dbCache.products || dbCache.products.length === 0) dbCache.products = defaultProducts;
        if (!dbCache.plans || dbCache.plans.length === 0) dbCache.plans = defaultPlans;
        if (!dbCache.settings) dbCache.settings = defaultSettings;
        if (!dbCache.ads) dbCache.ads = [];
        if (!dbCache.adEvents) dbCache.adEvents = [];
        if (!dbCache.discordLinks) dbCache.discordLinks = {};
        if (!dbCache.discordAuditLogs) dbCache.discordAuditLogs = [];
        if (!dbCache.apiKeys) dbCache.apiKeys = [];
        if (!dbCache.apiAuditLogs) dbCache.apiAuditLogs = [];
        if (!dbCache.webhooks) dbCache.webhooks = [];
        if (!dbCache.legalPages) dbCache.legalPages = [];
        if (!dbCache.statusComponents || dbCache.statusComponents.length === 0) dbCache.statusComponents = defaultStatusComponents;
        if (!dbCache.incidents) dbCache.incidents = [];
        if (!dbCache.scheduledMaintenances) dbCache.scheduledMaintenances = [];
        if (!dbCache.provisions) dbCache.provisions = [];
        if (!dbCache.settings.panelIntegration) {
          dbCache.settings.panelIntegration = defaultPanelIntegration;
        } else {
          dbCache.settings.panelIntegration = { ...defaultPanelIntegration, ...dbCache.settings.panelIntegration };
        }
        if (!dbCache.installationId) dbCache.installationId = getInstallationId();
      } else {
        dbCache = defaultDb();
      }

      // Ensure a super admin account always exists
      const existingAdmin = dbCache.users.find(u => u.email.toLowerCase() === adminEmail.toLowerCase());
      if (!existingAdmin) {
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        const adminUser: User = {
          id: 'usr_admin_root',
          username: 'admin',
          displayName: 'Platform Administrator',
          email: adminEmail.toLowerCase(),
          role: 'super_admin',
          isSuspended: false,
          emailVerified: true,
          twoFactorEnabled: false,
          authProvider: 'local',
          credits: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        dbCache.users.push(adminUser);
        dbCache.passwords[adminUser.id] = passwordHash;
        console.log(`[Database/INFO] Created default super admin account: ${adminEmail}`);
      }

      saveDbSync();
      return dbCache;
    } catch (err) {
      console.error('[Database/CRITICAL] Failed to initialize database:', err);
      dbCache = defaultDb();
      return dbCache;
    }
  })();

  return initPromise;
}

export function saveDbSync(): void {
  if (!dbCache) return;
  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Database/ERROR] Failed to persist database to disk:', err);
    }
  }, 150);
}

export function saveDbImmediate(): void {
  if (!dbCache) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database/ERROR] Failed to persist database to disk:', err);
  }
}

// Async alias kept for route modules that await the save call
export async function saveDb(): Promise<void> {
  saveDbSync();
}
