import { Router, Response } from 'express';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, AuthenticatedRequest, createAuditLog } from '../auth';
import {
  dispatchDiscordNotification,
  runDiscordAcceptanceTestSuite,
  getDiscordBotStatusDetails,
  restartDiscordBot,
  stopDiscordBot
} from '../discordService';
import { DiscordAccount, DiscordBotSettings } from '../../src/types';
import { getDiscordOAuthRedirectUri } from '../oauthUrlResolver';

const router = Router();

// GET /api/v1/discord/bot-status - Real-time Bot Gateway connection status
router.get('/bot-status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const statusDetails = await getDiscordBotStatusDetails();
  res.json({ success: true, data: statusDetails });
});

// ==========================================
// USER LEVEL DISCORD INTEGRATION ENDPOINTS
// ==========================================

// GET /api/v1/discord/user - Get connected Discord account
router.get('/user', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userId = req.user!.id;
  let discordAccount = db.discordLinks ? db.discordLinks[userId] : null;

  if (!discordAccount) {
    const userRecord = db.users.find(u => u.id === userId);
    if (userRecord && userRecord.discordId) {
      if (!db.discordLinks) db.discordLinks = {};
      discordAccount = {
        discordId: userRecord.discordId,
        username: userRecord.username || userRecord.displayName,
        globalName: userRecord.displayName || userRecord.username,
        avatar: userRecord.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${userRecord.username}`,
        email: userRecord.email,
        linkedAt: userRecord.updatedAt || userRecord.createdAt || new Date().toISOString()
      };
      db.discordLinks[userId] = discordAccount;
      saveDbSync();
    }
  }

  res.json({ success: true, data: discordAccount || null });
});

// POST /api/v1/discord/user/connect - Connect or OAuth link Discord account
router.post('/user/connect', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userId = req.user!.id;
  const user = req.user!;

  const { discordId, username, globalName, avatar, email } = req.body;

  if (!discordId || !discordId.trim() || !username || !username.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'DISCORD_OAUTH_REQUIRED', message: 'Valid Discord ID and username from real Discord OAuth2 authorization are required.' }
    });
  }

  const cleanDiscordId = discordId.trim();
  const cleanUsername = username.trim();

  db.users.forEach(u => {
    if (u.id !== userId && u.discordId === cleanDiscordId) {
      delete u.discordId;
      u.updatedAt = new Date().toISOString();
      if (db.discordLinks && db.discordLinks[u.id]) {
        delete db.discordLinks[u.id];
      }
    }
  });

  const userRecord = db.users.find(u => u.id === userId);
  if (userRecord) {
    userRecord.discordId = cleanDiscordId;
    userRecord.updatedAt = new Date().toISOString();
  }

  if (!db.discordLinks) db.discordLinks = {};

  const discordAccount: DiscordAccount = {
    discordId: cleanDiscordId,
    username: cleanUsername,
    globalName: globalName || cleanUsername,
    avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
    email: email || user.email,
    linkedAt: new Date().toISOString()
  };

  db.discordLinks[userId] = discordAccount;
  saveDbSync();

  await createAuditLog(user.id, user.email, user.role, 'DISCORD_ACCOUNT_LINKED', 'DISCORD', `Linked Discord account ${cleanUsername} (${cleanDiscordId})`);

  res.json({ success: true, message: `Discord account ${cleanUsername} connected successfully.`, data: discordAccount });
});

// DELETE /api/v1/discord/user/disconnect - Unlink Discord account
router.delete('/user/disconnect', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userId = req.user!.id;

  const userRecord = db.users.find(u => u.id === userId);
  if (userRecord && userRecord.discordId) {
    delete userRecord.discordId;
    userRecord.updatedAt = new Date().toISOString();
  }

  if (db.discordLinks && db.discordLinks[userId]) {
    const prev = db.discordLinks[userId];
    delete db.discordLinks[userId];
    saveDbSync();

    await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'DISCORD_ACCOUNT_UNLINKED', 'DISCORD', `Unlinked Discord account ${prev.username}`);
  } else {
    saveDbSync();
  }

  res.json({ success: true, message: 'Discord account disconnected.' });
});

// ==========================================
// ADMIN LEVEL DISCORD CONTROLS
// ==========================================

// GET /api/v1/discord/admin/settings - Get global Discord bot settings with masked credentials
router.get('/admin/settings', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const db = await getDb();
  const defaultDiscordSettings: DiscordBotSettings = {
    enabled: false, botToken: '', clientId: '', clientSecret: '', redirectUri: '',
    defaultWebhookUrl: '', botStatus: 'offline', commandRateLimitPerMin: 10, defaultNotificationEvents: []
  };

  const settings = db.settings?.discordSettings || defaultDiscordSettings;
  const botTokenMasked = settings.botToken ? `••••••••${settings.botToken.slice(-4)}` : '';
  const clientSecretMasked = settings.clientSecret ? `••••••••${settings.clientSecret.slice(-4)}` : '';
  const dynamicRedirectUri = getDiscordOAuthRedirectUri(req, db.settings);

  res.json({
    success: true,
    data: {
      ...settings,
      redirectUri: dynamicRedirectUri,
      botToken: botTokenMasked,
      clientSecret: clientSecretMasked,
      botTokenConfigured: !!settings.botToken,
      clientSecretConfigured: !!settings.clientSecret,
      botTokenMasked,
      clientSecretMasked
    }
  });
});

// PUT /api/v1/discord/admin/settings - Save global Discord bot settings
router.put('/admin/settings', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const db = await getDb();
  const currentSettings = (db.settings.discordSettings || {}) as any;

  let newBotToken = req.body.botToken;
  if (!newBotToken || newBotToken.startsWith('••••')) {
    newBotToken = currentSettings.botToken || '';
  }

  let newClientSecret = req.body.clientSecret;
  if (!newClientSecret || newClientSecret.startsWith('••••')) {
    newClientSecret = currentSettings.clientSecret || '';
  }

  db.settings.discordSettings = { ...currentSettings, ...req.body, botToken: newBotToken, clientSecret: newClientSecret };
  saveDbSync();

  if (db.settings.discordSettings.enabled && db.settings.discordSettings.botToken) {
    restartDiscordBot().catch(() => {});
  } else if (!db.settings.discordSettings.enabled) {
    stopDiscordBot().catch(() => {});
  }

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_UPDATE_DISCORD_SETTINGS', 'DISCORD', 'Updated global Discord bot and OAuth settings');

  const updatedMasked = {
    ...db.settings.discordSettings,
    botToken: db.settings.discordSettings.botToken ? `••••••••${db.settings.discordSettings.botToken.slice(-4)}` : '',
    clientSecret: db.settings.discordSettings.clientSecret ? `••••••••${db.settings.discordSettings.clientSecret.slice(-4)}` : '',
    botTokenConfigured: !!db.settings.discordSettings.botToken,
    clientSecretConfigured: !!db.settings.discordSettings.clientSecret
  };

  res.json({ success: true, message: 'Global Discord integration settings updated.', data: updatedMasked });
});

// POST /api/v1/discord/admin/bot-restart - Force restart Bot Gateway Client
router.post('/admin/bot-restart', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const details = await restartDiscordBot();
  res.json({ success: details.status === 'CONNECTED' || details.status === 'CONNECTING', message: `Bot gateway restart status: ${details.status}`, data: details });
});

// GET /api/v1/discord/admin/audit-logs - View Discord audit logs
router.get('/admin/audit-logs', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const db = await getDb();
  res.json({ success: true, data: db.discordAuditLogs || [] });
});

// POST /api/v1/discord/admin/bot-test - Test global bot webhook connection
router.post('/admin/bot-test', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const result = await dispatchDiscordNotification('PLAN_EXPIRING', {
    message: '📢 Admin Global Discord Bot Connection Verification Test',
    details: 'Dispatched from Admin Panel -> Discord Integrations.'
  });

  res.json({ success: result.success, message: result.message });
});

// POST /api/v1/discord/admin/run-acceptance-tests - Execute Acceptance Test Suite
router.post('/admin/run-acceptance-tests', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  try {
    const results = await runDiscordAcceptanceTestSuite(req.user!.id);
    const passedCount = results.filter(r => r.status === 'passed').length;
    const allPassed = passedCount === results.length;

    await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'DISCORD_ACCEPTANCE_TESTS_RUN', 'DISCORD', `Executed Discord Acceptance Test Suite: ${passedCount}/${results.length} passed.`);

    res.json({ success: true, data: { allPassed, passedCount, totalCount: results.length, results } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'TEST_RUNNER_ERROR', message: err.message || 'Acceptance test runner failed.' } });
  }
});

export default router;
