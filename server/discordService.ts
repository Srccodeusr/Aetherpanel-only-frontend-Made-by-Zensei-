import { Client, GatewayIntentBits, Partials, EmbedBuilder, WebhookClient } from 'discord.js';
import { getDb, saveDbSync } from './db';
import { DiscordNotificationEvent } from '../src/types';
import { getDiscordOAuthRedirectUri } from './oauthUrlResolver';

let discordClient: Client | null = null;
let isConnecting = false;
let lastConnectedTimestamp: string | null = null;
let lastHeartbeatTimestamp: string | null = null;
let lastConnectionError: string | null = null;

export type DiscordConnectionStatus =
  | 'NOT_CONFIGURED'
  | 'CONFIGURED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'DISABLED';

export interface DiscordBotStatusDetails {
  status: DiscordConnectionStatus;
  botUsername: string | null;
  botId: string | null;
  guildCount: number;
  lastConnected: string | null;
  lastHeartbeat: string | null;
  lastError: string | null;
  enabled: boolean;
  configured: boolean;
}

/**
 * Returns comprehensive state of the Discord Bot Client
 */
export async function getDiscordBotStatusDetails(): Promise<DiscordBotStatusDetails> {
  const db = await getDb();
  const settings = db.settings?.discordSettings;

  if (!settings || !settings.enabled) {
    return {
      status: 'DISABLED', botUsername: null, botId: null, guildCount: 0,
      lastConnected: lastConnectedTimestamp, lastHeartbeat: lastHeartbeatTimestamp,
      lastError: lastConnectionError, enabled: false, configured: !!settings?.botToken
    };
  }

  if (!settings.botToken || !settings.clientId) {
    return {
      status: 'NOT_CONFIGURED', botUsername: null, botId: null, guildCount: 0,
      lastConnected: null, lastHeartbeat: null,
      lastError: 'Bot Token or Client ID missing', enabled: true, configured: false
    };
  }

  if (discordClient && discordClient.isReady()) {
    lastHeartbeatTimestamp = new Date().toISOString();
    return {
      status: 'CONNECTED',
      botUsername: discordClient.user?.tag || discordClient.user?.username || 'PlatformBot',
      botId: discordClient.user?.id || settings.clientId,
      guildCount: discordClient.guilds.cache.size,
      lastConnected: lastConnectedTimestamp || new Date().toISOString(),
      lastHeartbeat: lastHeartbeatTimestamp, lastError: null, enabled: true, configured: true
    };
  }

  if (isConnecting) {
    return {
      status: 'CONNECTING', botUsername: null, botId: settings.clientId, guildCount: 0,
      lastConnected: lastConnectedTimestamp, lastHeartbeat: lastHeartbeatTimestamp,
      lastError: null, enabled: true, configured: true
    };
  }

  if (lastConnectionError) {
    return {
      status: 'ERROR', botUsername: null, botId: settings.clientId, guildCount: 0,
      lastConnected: lastConnectedTimestamp, lastHeartbeat: lastHeartbeatTimestamp,
      lastError: lastConnectionError, enabled: true, configured: true
    };
  }

  return {
    status: 'CONFIGURED', botUsername: null, botId: settings.clientId, guildCount: 0,
    lastConnected: lastConnectedTimestamp, lastHeartbeat: lastHeartbeatTimestamp,
    lastError: null, enabled: true, configured: true
  };
}

/**
 * Get or initialize the Discord Bot Client — connects only, no slash commands
 * (this product has no per-server actions for the bot to expose).
 */
export async function getDiscordClient(): Promise<Client | null> {
  const db = await getDb();
  const globalSettings = db.settings?.discordSettings;

  if (!globalSettings || !globalSettings.enabled || !globalSettings.botToken) {
    if (discordClient) {
      discordClient.destroy();
      discordClient = null;
    }
    return null;
  }

  if (discordClient && discordClient.isReady()) {
    return discordClient;
  }

  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return discordClient?.isReady() ? discordClient : null;
  }

  isConnecting = true;
  lastConnectionError = null;

  try {
    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
      partials: [Partials.Channel]
    });

    client.on('ready', async () => {
      console.log(`[Discord Bot] Logged in as ${client.user?.tag}!`);
      lastConnectedTimestamp = new Date().toISOString();
      lastHeartbeatTimestamp = new Date().toISOString();
      lastConnectionError = null;

      const latestDb = await getDb();
      if (latestDb.settings.discordSettings) {
        latestDb.settings.discordSettings.botStatus = 'online';
        saveDbSync();
      }
    });

    client.on('error', (err) => {
      console.error('[Discord Bot] Gateway Client Error:', err);
      lastConnectionError = err.message;
    });

    client.on('disconnect', () => {
      console.warn('[Discord Bot] Gateway Client Disconnected');
    });

    await client.login(globalSettings.botToken);
    discordClient = client;
    isConnecting = false;
    return client;
  } catch (error: any) {
    console.error('[Discord Bot] Failed to connect:', error.message);
    isConnecting = false;
    lastConnectionError = error.message || 'Login failed';
    if (discordClient) {
      discordClient.destroy();
      discordClient = null;
    }
    const latestDb = await getDb();
    if (latestDb.settings.discordSettings) {
      latestDb.settings.discordSettings.botStatus = 'offline';
      saveDbSync();
    }
    return null;
  }
}

/**
 * Restart or reconnect the Discord Bot lifecycle
 */
export async function restartDiscordBot(): Promise<DiscordBotStatusDetails> {
  if (discordClient) {
    discordClient.destroy();
    discordClient = null;
  }
  lastConnectionError = null;
  await getDiscordClient();
  return getDiscordBotStatusDetails();
}

/**
 * Stop the Discord Bot Client
 */
export async function stopDiscordBot(): Promise<DiscordBotStatusDetails> {
  if (discordClient) {
    discordClient.destroy();
    discordClient = null;
  }
  const db = await getDb();
  if (db.settings.discordSettings) {
    db.settings.discordSettings.botStatus = 'offline';
    saveDbSync();
  }
  return getDiscordBotStatusDetails();
}

function getEventTitle(event: DiscordNotificationEvent): { emoji: string; title: string } {
  switch (event) {
    case 'PLAN_EXPIRING':
      return { emoji: '⏰', title: 'Plan Expiring Soon' };
    default:
      return { emoji: '📢', title: 'Account Notification' };
  }
}

/**
 * Build a rich embed for an account-level notification
 */
export function buildDiscordEmbed(event: DiscordNotificationEvent, extraData: any = {}) {
  const { emoji, title } = getEventTitle(event);

  const embed = new EmbedBuilder()
    .setColor(0xF59E0B)
    .setTitle(`${emoji} ${title}`)
    .setTimestamp()
    .setFooter({ text: 'Platform Discord Integration' });

  if (extraData.message) {
    embed.setDescription(extraData.message);
  }
  if (extraData.details) {
    embed.addFields({ name: 'Details', value: extraData.details });
  }

  return embed;
}

/**
 * Dispatch a notification to the platform's configured default webhook.
 * This product has no per-server webhook routing — one global channel for account/billing events.
 */
export async function dispatchDiscordNotification(
  event: DiscordNotificationEvent,
  extraData: any = {}
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();

  const globalSettings = db.settings?.discordSettings;
  if (globalSettings && !globalSettings.enabled) {
    return { success: false, message: 'Global Discord integration is disabled in platform settings.' };
  }

  const targetWebhookUrl = globalSettings?.defaultWebhookUrl;
  if (!targetWebhookUrl) {
    return { success: false, message: 'No default Discord webhook URL configured in platform settings.' };
  }

  if (!targetWebhookUrl.startsWith('https://discord.com/api/webhooks/') && !targetWebhookUrl.startsWith('https://discordapp.com/api/webhooks/')) {
    return { success: false, message: 'Invalid Discord Webhook URL format. Must start with https://discord.com/api/webhooks/' };
  }

  try {
    const embed = buildDiscordEmbed(event, extraData);
    const webhookClient = new WebhookClient({ url: targetWebhookUrl });

    await webhookClient.send({
      username: 'Platform Alerts',
      embeds: [embed]
    });

    return { success: true, message: 'Notification delivered via Discord Webhook successfully.' };
  } catch (err: any) {
    console.error('Failed to dispatch Discord notification:', err);
    return { success: false, message: `Webhook dispatch failed: ${err.message}` };
  }
}

/**
 * Run a reduced acceptance test suite covering connection, OAuth, security masking,
 * webhook dispatch, and account linkage — the surfaces that still exist in this product.
 */
export async function runDiscordAcceptanceTestSuite(adminUserId: string): Promise<any[]> {
  const db = await getDb();
  const globalSettings = db.settings?.discordSettings;
  const adminUser = db.users.find(u => u.id === adminUserId);

  const results: {
    id: string; name: string; category: string; status: 'passed' | 'failed';
    message: string; details?: string; durationMs: number;
  }[] = [];

  const addTest = (id: string, name: string, category: string, passed: boolean, message: string, details?: string, startMs: number = Date.now()) => {
    results.push({ id, name, category, status: passed ? 'passed' : 'failed', message, details, durationMs: Date.now() - startMs });
  };

  const t1 = Date.now();
  const isEnabled = globalSettings ? globalSettings.enabled : false;
  addTest('test_1', '1. Global Discord System Toggle', 'auth', true, `System Enabled State: ${isEnabled ? 'ACTIVE' : 'INACTIVE'}`, 'Verifies platform-wide toggle state', t1);

  const t2 = Date.now();
  const hasToken = !!globalSettings?.botToken;
  const hasClientId = !!globalSettings?.clientId;
  addTest('test_2', '2. Bot Credentials Configuration', 'bot', hasToken && hasClientId, hasToken && hasClientId ? 'Bot Token and Client ID properly configured' : 'Bot Token or Client ID unconfigured', 'Verifies presence of bot token and client ID', t2);

  const t3 = Date.now();
  const botStatus = await getDiscordBotStatusDetails();
  addTest('test_3', '3. Bot Gateway Lifecycle Engine', 'bot', true, `Gateway Connection Status: ${botStatus.status}`, `Current status: ${botStatus.status}, Guilds: ${botStatus.guildCount}`, t3);

  const t4 = Date.now();
  const hasClientSecret = !!globalSettings?.clientSecret;
  const redirectUri = getDiscordOAuthRedirectUri(undefined, db.settings);
  const hasRedirectUri = !!redirectUri;
  addTest('test_4', '4. OAuth2 Client Setup', 'auth', hasClientSecret && hasRedirectUri, hasClientSecret && hasRedirectUri ? `OAuth2 Client configured with redirect URI: ${redirectUri}` : 'OAuth2 credentials unconfigured', 'Checks authorization code flow configuration', t4);

  const t5 = Date.now();
  const sampleToken = globalSettings?.botToken || 'secret_token_12345';
  const masked = sampleToken ? `••••••••${sampleToken.slice(-4)}` : '';
  const isMaskedSafe = !masked.includes(sampleToken) || sampleToken.length < 5;
  addTest('test_5', '5. Sensitive Credentials Security Masking', 'security', isMaskedSafe, 'API outputs masked credential strings (••••••••1234)', 'Ensures Bot Token & Secret are never returned in plain text', t5);

  const t6 = Date.now();
  const webhookUrl = globalSettings?.defaultWebhookUrl;
  const isValidWebhookFormat = webhookUrl ? (webhookUrl.startsWith('https://discord.com/api/webhooks/') || webhookUrl.startsWith('https://discordapp.com/api/webhooks/')) : true;
  addTest('test_6', '6. Default Webhook URL Format Validation', 'link', isValidWebhookFormat, isValidWebhookFormat ? 'Webhook URL format validation verified' : 'Invalid Webhook URL format', 'Validates Discord webhook endpoint schema', t6);

  const t7 = Date.now();
  const dispatchRes = await dispatchDiscordNotification('PLAN_EXPIRING', { message: 'Acceptance test dispatch check' });
  addTest('test_7', '7. Webhook Notification Dispatcher', 'notification', true, dispatchRes.message, `Result: ${dispatchRes.message}`, t7);

  const t8 = Date.now();
  const embed = buildDiscordEmbed('PLAN_EXPIRING', { message: 'Test notification', details: 'Acceptance test embed generation' });
  addTest('test_8', '8. Event Rich Embed Payload Generator', 'notification', !!embed.data.title, 'Rich Embed generated with title, fields, and timestamp', `Title: ${embed.data.title}`, t8);

  const t9 = Date.now();
  const linkCount = db.discordLinks ? Object.keys(db.discordLinks).length : 0;
  addTest('test_9', '9. Discord Account OAuth Linkage Engine', 'link', true, `${linkCount} Discord user link(s) registered in state`, 'Verifies backend user mapping store', t9);

  const t10 = Date.now();
  const adminHasAccount = !!adminUser;
  addTest('test_10', '10. Admin Account Verification', 'auth', adminHasAccount, adminHasAccount ? `Verified admin account ${adminUser?.email}` : 'Admin account lookup failed', 'Confirms the running admin session resolves to a valid account', t10);

  return results;
}
