import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, requireRole, AuthenticatedRequest, createAuditLog } from '../auth';
import { User, Product, Plan, Coupon, Announcement } from '../../src/types';
import { getDiscordOAuthRedirectUri } from '../oauthUrlResolver';
import { testIpRiskConnection } from '../utils/ipRiskProvider';

const router = Router();

// Require admin or support role for all routes in this router
router.use(authMiddleware);
router.use(requireRole(['admin', 'super_admin', 'support', 'moderator']));

// GET /api/v1/admin/stats - Global business overview
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();

  const totalUsers = db.users.length;
  const activeUsers = db.users.filter(u => !u.isSuspended).length;
  const suspendedUsers = totalUsers - activeUsers;

  const paidOrders = db.orders.filter(o => o.status === 'paid');
  const totalRevenue = paidOrders.reduce((acc, o) => acc + o.amount, 0);
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const last30DaysRevenue = paidOrders
    .filter(o => new Date(o.createdAt).getTime() >= thirtyDaysAgo)
    .reduce((acc, o) => acc + o.amount, 0);

  const pendingOrders = db.orders.filter(o => o.status === 'pending').length;
  const failedOrders = db.orders.filter(o => o.status === 'failed').length;

  const openTickets = db.tickets.filter(t => t.status === 'open').length;
  const pendingTickets = db.tickets.filter(t => t.status === 'pending').length;

  const activeCoupons = db.coupons.filter(c => c.isActive).length;

  res.json({
    success: true,
    data: {
      users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers },
      revenue: {
        total: parseFloat(totalRevenue.toFixed(2)),
        last30Days: parseFloat(last30DaysRevenue.toFixed(2)),
        ordersCount: db.orders.length
      },
      orders: { pending: pendingOrders, paid: paidOrders.length, failed: failedOrders },
      support: { open: openTickets, pending: pendingTickets, total: db.tickets.length },
      coupons: { active: activeCoupons }
    }
  });
});

// --- USER MANAGEMENT ---
// GET /api/v1/admin/users
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.users });
});

// POST /api/v1/admin/users - Admin Create User
router.post('/users', async (req: AuthenticatedRequest, res: Response) => {
  const { email, username, password, role, credits, displayName } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Email, username, and password are required' } });
  }

  const db = await getDb();
  const existingEmail = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (existingEmail) {
    return res.status(400).json({ success: false, error: { code: 'EMAIL_IN_USE', message: 'User with this email already exists' } });
  }

  const existingUsername = db.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  if (existingUsername) {
    return res.status(400).json({ success: false, error: { code: 'USERNAME_IN_USE', message: 'Username is already taken' } });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser: User = {
    id: `usr_${Date.now()}`,
    email: email.trim().toLowerCase(),
    username: username.trim().toLowerCase(),
    displayName: displayName || username.trim(),
    role: role || 'user',
    plan: 'free',
    credits: parseFloat(credits) || 0,
    isSuspended: false,
    emailVerified: true,
    twoFactorEnabled: false,
    tokenVersion: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.users.push(newUser);
  db.passwords[newUser.id] = passwordHash;
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_CREATE_USER', newUser.id, `Admin created user ${newUser.email} with role ${newUser.role}`);
  res.json({ success: true, data: newUser, message: `User ${newUser.email} created successfully` });
});

// PUT /api/v1/admin/users/:id - Update user role, credits, status
router.put('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const user = db.users.find(u => u.id === req.params.id);

  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  const { role, isSuspended, credits, displayName } = req.body;

  if (role && ['user', 'support', 'moderator', 'admin', 'super_admin'].includes(role)) {
    user.role = role;
  }
  if (typeof isSuspended === 'boolean') {
    user.isSuspended = isSuspended;
  }
  if (typeof credits === 'number') {
    user.credits = credits;
  }
  if (displayName) {
    user.displayName = displayName;
  }

  user.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_UPDATE_USER', user.id, `Updated user ${user.email} (Role: ${user.role}, Suspended: ${user.isSuspended})`);

  res.json({ success: true, data: user });
});

// PATCH /api/v1/admin/users/:id/role
router.patch('/users/:id/role', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  const { role } = req.body;
  if (!role || !['user', 'support', 'moderator', 'admin', 'super_admin'].includes(role)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: 'Invalid role specified' } });
  }

  user.role = role;
  user.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_UPDATE_USER_ROLE', user.id, `Changed role of user ${user.email} to ${role}`);
  res.json({ success: true, data: user, message: `User role updated to ${role}` });
});

// PATCH /api/v1/admin/users/:id/suspend
router.patch('/users/:id/suspend', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  if (user.id === req.user!.id) {
    return res.status(400).json({ success: false, error: { code: 'CANNOT_SUSPEND_SELF', message: 'You cannot suspend your own account' } });
  }

  const isSuspended = typeof req.body.isSuspended === 'boolean' ? req.body.isSuspended : !user.isSuspended;
  user.isSuspended = isSuspended;
  user.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_SUSPEND_USER', user.id, `${isSuspended ? 'Suspended' : 'Unsuspended'} user ${user.email}`);
  res.json({ success: true, data: user, message: `User ${isSuspended ? 'suspended' : 'unsuspended'}` });
});

// POST /api/v1/admin/users/:id/credits - Add, remove, or set user balance
router.post('/users/:id/credits', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  const { amount, mode } = req.body;
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Valid numerical amount is required' } });
  }

  const currentCredits = user.credits || 0;
  if (mode === 'remove' || mode === 'deduct') {
    user.credits = Math.max(0, parseFloat((currentCredits - Math.abs(numAmount)).toFixed(2)));
  } else if (mode === 'set') {
    user.credits = Math.max(0, parseFloat(numAmount.toFixed(2)));
  } else {
    user.credits = parseFloat((currentCredits + Math.abs(numAmount)).toFixed(2));
  }

  user.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_ADJUST_CREDITS', user.id, `Adjusted credits for ${user.email} (${mode || 'add'}: $${numAmount}) -> Balance: $${user.credits}`);
  res.json({ success: true, data: user, message: `User credits updated to $${user.credits.toFixed(2)}` });
});

// POST /api/v1/admin/users/:id/change-password and /reset-password - Admin directly reset user password
const handleAdminPasswordReset = async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters.' } });
  }

  const db = await getDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
  }

  db.passwords[user.id] = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  const currentVer = user.tokenVersion !== undefined ? user.tokenVersion : 1;
  user.tokenVersion = currentVer + 1;
  user.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'ADMIN_FORCE_PASSWORD_RESET', user.id,
    `Admin reset password for user ${user.email} (${user.id})`
  );

  res.json({ success: true, message: `Password for user ${user.displayName || user.username} updated successfully.` });
};

router.post('/users/:id/change-password', handleAdminPasswordReset);
router.post('/users/:id/reset-password', handleAdminPasswordReset);

// DELETE /api/v1/admin/users/:id
router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userIndex = db.users.findIndex(u => u.id === req.params.id);
  if (userIndex === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  const user = db.users[userIndex];
  if (user.id === req.user!.id) {
    return res.status(400).json({ success: false, error: { code: 'CANNOT_DELETE_SELF', message: 'Cannot delete your own active administrator account' } });
  }

  if (user.role === 'super_admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only a Super Admin can delete another Super Admin' } });
  }

  // Clean up orphan records tied to this user
  delete db.passwords[user.id];
  if (db.discordLinks && db.discordLinks[user.id]) {
    delete db.discordLinks[user.id];
  }
  db.tickets = (db.tickets || []).filter(t => t.userId !== user.id);
  db.orders = (db.orders || []).filter(o => o.userId !== user.id);
  db.apiKeys = (db.apiKeys || []).filter(k => k.userId !== user.id);

  db.users.splice(userIndex, 1);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_DELETE_USER', user.id, `Deleted user account ${user.email} and cleaned up all associated records.`);
  res.json({ success: true, message: `User ${user.email} and all associated records deleted successfully` });
});

// --- PRODUCT & PLAN MANAGEMENT ---
// GET /api/v1/admin/products
router.get('/products', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.products });
});

// POST /api/v1/admin/products - Create product
router.post('/products', async (req: AuthenticatedRequest, res: Response) => {
  const { name, slug, description, category, icon } = req.body;
  const db = await getDb();

  const newProd: Product = {
    id: `prod_${Date.now()}`,
    name: name.trim(),
    slug: (slug || name).toLowerCase().replace(/[^a-z0-9]/g, '-'),
    description: description || '',
    category: category || 'minecraft',
    icon: icon || 'Gamepad2',
    isActive: true,
    sortOrder: db.products.length + 1
  };

  db.products.push(newProd);
  saveDbSync();

  res.json({ success: true, data: newProd });
});

// GET /api/v1/admin/plans
router.get('/plans', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.plans });
});

// POST /api/v1/admin/plans and /api/v1/admin/plans/create
const handleCreatePlan = async (req: AuthenticatedRequest, res: Response) => {
  const {
    productId, name, description, priceMonthly, priceYearly,
    ramMB, cpuCores, diskGB, backupLimit, databaseLimit, serverLimit, features, locations, isPopular
  } = req.body;

  const db = await getDb();

  const newPlan: Plan = {
    id: `plan_${Date.now()}`,
    productId: productId || 'prod_minecraft',
    name: name.trim(),
    description: description || '',
    priceMonthly: parseFloat(priceMonthly) || 0,
    priceYearly: parseFloat(priceYearly) || ((parseFloat(priceMonthly) || 0) * 10),
    ramMB: parseInt(ramMB) || 2048,
    cpuCores: parseFloat(cpuCores) || 1,
    diskGB: parseInt(diskGB) || 15,
    backupLimit: parseInt(backupLimit) || 2,
    databaseLimit: parseInt(databaseLimit) || 1,
    serverLimit: parseInt(serverLimit) || 1,
    networkMbps: 1000,
    features: Array.isArray(features) ? features : ['DDoS Protection', 'NVMe Storage', 'Instant Setup'],
    locations: Array.isArray(locations) ? locations : ['local'],
    isPopular: !!isPopular,
    isActive: true
  };

  db.plans.push(newPlan);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_CREATE_PLAN', newPlan.id, `Created plan tier '${newPlan.name}' ($${newPlan.priceMonthly}/mo)`);
  res.json({ success: true, data: newPlan, message: 'Plan created successfully' });
};

router.post('/plans', handleCreatePlan);
router.post('/plans/create', handleCreatePlan);

// PUT /api/v1/admin/plans/:id
router.put('/plans/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const plan = db.plans.find(p => p.id === req.params.id);
  if (!plan) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });

  Object.assign(plan, req.body);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_UPDATE_PLAN', plan.id, `Updated plan tier '${plan.name}'`);
  res.json({ success: true, data: plan, message: 'Plan updated' });
});

// DELETE /api/v1/admin/plans/:id
router.delete('/plans/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const planIdx = db.plans.findIndex(p => p.id === req.params.id);
  if (planIdx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });

  const plan = db.plans[planIdx];
  db.plans.splice(planIdx, 1);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_DELETE_PLAN', plan.id, `Deleted plan tier '${plan.name}'`);
  res.json({ success: true, message: `Plan '${plan.name}' deleted successfully` });
});

// --- COUPONS ---
// GET /api/v1/admin/coupons
router.get('/coupons', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.coupons || [] });
});

// POST /api/v1/admin/coupons and /api/v1/admin/coupons/create
const handleCreateCoupon = async (req: AuthenticatedRequest, res: Response) => {
  const { code, discountType, discountValue, usageLimit } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Coupon code is required' } });
  }

  const db = await getDb();
  const existing = db.coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase());
  if (existing) {
    return res.status(400).json({ success: false, error: { code: 'DUPLICATE_CODE', message: 'Coupon code already exists' } });
  }

  const coupon: Coupon = {
    id: `coup_${Date.now()}`,
    code: code.trim().toUpperCase(),
    discountType: discountType === 'fixed' ? 'fixed' : 'percent',
    discountValue: parseFloat(discountValue) || 10,
    usageLimit: usageLimit ? parseInt(usageLimit) : undefined,
    timesUsed: 0,
    isActive: true
  };

  db.coupons.push(coupon);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_CREATE_COUPON', coupon.id, `Created promo coupon '${coupon.code}'`);
  res.json({ success: true, data: coupon, message: 'Coupon created successfully' });
};

router.post('/coupons', handleCreateCoupon);
router.post('/coupons/create', handleCreateCoupon);

// DELETE /api/v1/admin/coupons/:id
router.delete('/coupons/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const idx = db.coupons.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' } });

  const coupon = db.coupons[idx];
  db.coupons.splice(idx, 1);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_DELETE_COUPON', coupon.id, `Deleted promo coupon '${coupon.code}'`);
  res.json({ success: true, message: `Coupon '${coupon.code}' deleted successfully` });
});

// PATCH /api/v1/admin/coupons/:id/toggle
router.patch('/coupons/:id/toggle', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const coupon = db.coupons.find(c => c.id === req.params.id);
  if (!coupon) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' } });

  coupon.isActive = !coupon.isActive;
  saveDbSync();

  res.json({ success: true, data: coupon, message: `Coupon '${coupon.code}' is now ${coupon.isActive ? 'active' : 'disabled'}` });
});

// --- ANNOUNCEMENTS ---
// GET /api/v1/admin/announcements
router.get('/announcements', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.announcements });
});

// POST /api/v1/admin/announcements
router.post('/announcements', async (req: AuthenticatedRequest, res: Response) => {
  const { title, content, type } = req.body;
  const db = await getDb();

  const ann: Announcement = {
    id: `ann_${Date.now()}`,
    title: title.trim(),
    content: content.trim(),
    type: type || 'info',
    isPublished: true,
    createdAt: new Date().toISOString()
  };

  db.announcements.unshift(ann);
  saveDbSync();

  res.json({ success: true, data: ann });
});

// DELETE /api/v1/admin/announcements/:id
router.delete('/announcements/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  db.announcements = db.announcements.filter(a => a.id !== req.params.id);
  saveDbSync();
  res.json({ success: true, message: 'Announcement deleted.' });
});

// --- AUDIT LOGS ---
// GET /api/v1/admin/audit-logs
router.get('/audit-logs', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.auditLogs });
});

// --- SYSTEM SETTINGS ---
// GET /api/v1/admin/settings
router.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.settings });
});

// PUT /api/v1/admin/settings
router.put('/settings', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  Object.assign(db.settings, req.body);
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_UPDATE_SETTINGS', 'SYSTEM', 'Updated system settings');

  res.json({ success: true, data: db.settings });
});

// Helper URL validator for social links
const isValidSocialUrl = (url: string): boolean => {
  if (!url) return true;
  const trimmed = url.trim();
  if (trimmed === '') return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

// GET /api/v1/admin/settings/social-links
router.get('/settings/social-links', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const socialLinks = db.settings.socialLinks || {
    discord: db.settings.discordUrl || '',
    twitter: '',
    github: ''
  };
  res.json({ success: true, data: socialLinks });
});

// PUT /api/v1/admin/settings/social-links
router.put('/settings/social-links', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const { discord, twitter, github } = req.body || {};

  const cleanDiscord = typeof discord === 'string' ? discord.trim() : '';
  const cleanTwitter = typeof twitter === 'string' ? twitter.trim() : '';
  const cleanGithub = typeof github === 'string' ? github.trim() : '';

  if (cleanDiscord && !isValidSocialUrl(cleanDiscord)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_URL', message: 'Discord URL must be a valid HTTP or HTTPS URL (e.g. https://discord.gg/yourserver)' } });
  }
  if (cleanTwitter && !isValidSocialUrl(cleanTwitter)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_URL', message: 'X / Twitter URL must be a valid HTTP or HTTPS URL (e.g. https://x.com/yourhandle)' } });
  }
  if (cleanGithub && !isValidSocialUrl(cleanGithub)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_URL', message: 'GitHub URL must be a valid HTTP or HTTPS URL (e.g. https://github.com/yourrepo)' } });
  }

  const db = await getDb();
  db.settings.socialLinks = { discord: cleanDiscord, twitter: cleanTwitter, github: cleanGithub };

  if (cleanDiscord) {
    db.settings.discordUrl = cleanDiscord;
  }

  saveDbSync();

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'ADMIN_UPDATE_SOCIAL_LINKS', 'SETTINGS',
    `Updated global social links (Discord: ${cleanDiscord || 'None'}, X/Twitter: ${cleanTwitter || 'None'}, GitHub: ${cleanGithub || 'None'})`
  );

  res.json({ success: true, message: 'Social links updated successfully.', data: db.settings.socialLinks });
});

// GET /api/v1/admin/payment-settings
router.get('/payment-settings', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.settings.paymentGateways });
});

// PUT /api/v1/admin/payment-settings
router.put('/payment-settings', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  db.settings.paymentGateways = { ...db.settings.paymentGateways, ...req.body };
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_UPDATE_PAYMENT_GATEWAYS', 'PAYMENTS', 'Updated payment gateways and QR code settings');

  res.json({ success: true, data: db.settings.paymentGateways });
});

// --- ORDERS & PAYMENT APPROVALS ---
// GET /api/v1/admin/orders
router.get('/orders', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const statusFilter = req.query.status as string;
  let orders = db.orders;
  if (statusFilter) {
    orders = orders.filter(o => o.status === statusFilter);
  }
  res.json({ success: true, data: orders });
});

// POST /api/v1/admin/orders/:id/approve
router.post('/orders/:id/approve', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const order = db.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
  }
  if (order.status === 'paid') {
    return res.status(400).json({ success: false, error: { code: 'ALREADY_PAID', message: 'Order is already marked as paid' } });
  }

  order.status = 'paid';
  order.adminNote = req.body.adminNote || `Approved by ${req.user!.email} on ${new Date().toLocaleDateString()}`;

  const targetUser = db.users.find(u => u.id === order.userId);
  if (targetUser) {
    targetUser.credits = parseFloat((targetUser.credits + order.amount).toFixed(2));
  }

  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_APPROVE_PAYMENT', order.id, `Approved manual payment #${order.id} of $${order.amount} for user ${order.userEmail}`);

  res.json({ success: true, message: `Payment #${order.id} approved! $${order.amount.toFixed(2)} added to ${targetUser?.email || 'user'}'s balance.`, data: order });
});

// POST /api/v1/admin/orders/:id/reject
router.post('/orders/:id/reject', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const order = db.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
  }

  order.status = 'failed';
  order.adminNote = req.body.reason || 'Payment rejected by administrator.';

  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_REJECT_PAYMENT', order.id, `Rejected manual payment #${order.id} for user ${order.userEmail}`);

  res.json({ success: true, message: `Payment #${order.id} rejected.`, data: order });
});

// --- SUPPORT DESK MANAGEMENT ---
// GET /api/v1/admin/support/tickets
router.get('/support/tickets', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.tickets || [] });
});

// GET /api/v1/admin/support/tickets/:id
router.get('/support/tickets/:id', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const ticket = (db.tickets || []).find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
  res.json({ success: true, data: ticket });
});

// POST /api/v1/admin/support/tickets/:id/reply
router.post('/support/tickets/:id/reply', async (req: AuthenticatedRequest, res: Response) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, error: { code: 'EMPTY_MESSAGE', message: 'Message content is required' } });
  }

  const db = await getDb();
  const ticket = (db.tickets || []).find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

  const replyMsg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    senderId: req.user!.id,
    senderName: req.user!.displayName || req.user!.email.split('@')[0],
    senderRole: req.user!.role,
    message: message.trim(),
    createdAt: new Date().toISOString()
  };

  ticket.messages.push(replyMsg);
  ticket.status = 'answered';
  ticket.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'SUPPORT_TICKET_STAFF_REPLY', ticket.id, `Staff replied to ticket #${ticket.id} (${ticket.subject})`);

  res.json({ success: true, data: ticket, message: 'Reply sent successfully' });
});

// PATCH /api/v1/admin/support/tickets/:id/close
router.patch('/support/tickets/:id/close', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const ticket = (db.tickets || []).find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

  ticket.status = 'closed';
  ticket.updatedAt = new Date().toISOString();
  saveDbSync();

  await createAuditLog(req.user!.id, req.user!.email, req.user!.role, 'SUPPORT_TICKET_CLOSE', ticket.id, `Closed support ticket #${ticket.id}`);
  res.json({ success: true, data: ticket, message: 'Ticket closed' });
});

// PUT /api/v1/admin/support/tickets/:id/status
router.put('/support/tickets/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  const { status, priority } = req.body;
  const db = await getDb();
  const ticket = (db.tickets || []).find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

  if (status) ticket.status = status;
  if (priority) ticket.priority = priority;
  ticket.updatedAt = new Date().toISOString();
  saveDbSync();

  res.json({ success: true, data: ticket });
});

// --- LEGAL PAGES CONTENT MANAGEMENT ---
// GET /api/v1/admin/legal
router.get('/legal', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({ success: true, data: db.legalPages || [] });
});

// GET /api/v1/admin/legal/:slug
router.get('/legal/:slug', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const page = (db.legalPages || []).find(p => p.slug === req.params.slug);
  if (!page) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Legal document not found' } });
  }
  res.json({ success: true, data: page });
});

// PUT /api/v1/admin/legal/:slug
router.put('/legal/:slug', async (req: AuthenticatedRequest, res: Response) => {
  const { title, summary, content, version, isPublished } = req.body;
  const db = await getDb();
  if (!db.legalPages) db.legalPages = [];

  let page = db.legalPages.find(p => p.slug === req.params.slug);
  if (!page) {
    page = {
      id: `legal_${req.params.slug}`,
      slug: req.params.slug,
      title: title || req.params.slug,
      summary: summary || '',
      content: content || '',
      version: version || '1.0.0',
      isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
      lastUpdatedAt: new Date().toISOString(),
      updatedBy: req.user?.displayName || req.user?.email || 'Administrator'
    };
    db.legalPages.push(page);
  } else {
    if (title !== undefined) page.title = title.trim();
    if (summary !== undefined) page.summary = summary.trim();
    if (content !== undefined) page.content = content;
    if (version !== undefined) page.version = version.trim();
    if (isPublished !== undefined) page.isPublished = Boolean(isPublished);
    page.lastUpdatedAt = new Date().toISOString();
    page.updatedBy = req.user?.displayName || req.user?.email || 'Administrator';
  }

  saveDbSync();

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'ADMIN_UPDATE_LEGAL', page.slug,
    `Updated legal document '${page.title}' (${page.slug}) version ${page.version}`
  );

  res.json({ success: true, message: `Legal document '${page.title}' saved successfully.`, data: page });
});

// --- AUTH PROVIDERS & CREDENTIALS MANAGEMENT ---
// GET /api/v1/admin/auth-providers
router.get('/auth-providers', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const discordSettings = db.settings.authProviders?.discord;
  const redirectUri = getDiscordOAuthRedirectUri(req, db.settings);

  const authProviders = {
    emailPassword: { enabled: db.settings.authProviders?.emailPassword?.enabled ?? true },
    google: {
      enabled: db.settings.authProviders?.google?.enabled ?? true,
      firebaseApiKey: db.settings.authProviders?.google?.firebaseApiKey || process.env.VITE_FIREBASE_API_KEY || '',
      firebaseAuthDomain: db.settings.authProviders?.google?.firebaseAuthDomain || process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      firebaseProjectId: db.settings.authProviders?.google?.firebaseProjectId || process.env.VITE_FIREBASE_PROJECT_ID || '',
      firebaseStorageBucket: db.settings.authProviders?.google?.firebaseStorageBucket || process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      firebaseMessagingSenderId: db.settings.authProviders?.google?.firebaseMessagingSenderId || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      firebaseAppId: db.settings.authProviders?.google?.firebaseAppId || process.env.VITE_FIREBASE_APP_ID || ''
    },
    discord: {
      enabled: discordSettings?.enabled ?? true,
      clientId: discordSettings?.clientId || process.env.DISCORD_CLIENT_ID || '',
      clientSecret: (discordSettings?.clientSecret || process.env.DISCORD_CLIENT_SECRET) ? '••••••••••••••••' : '',
      redirectUri
    }
  };

  res.json({ success: true, data: authProviders });
});

// PUT /api/v1/admin/auth-providers
router.put('/auth-providers', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const db = await getDb();
  const incoming = req.body;

  if (!db.settings.authProviders) {
    db.settings.authProviders = {
      emailPassword: { enabled: true },
      google: { enabled: true },
      discord: { enabled: true }
    };
  }

  if (incoming.emailPassword) {
    db.settings.authProviders.emailPassword = { ...db.settings.authProviders.emailPassword, ...incoming.emailPassword };
  }
  if (incoming.google) {
    db.settings.authProviders.google = { ...db.settings.authProviders.google, ...incoming.google };
  }
  if (incoming.discord) {
    const existingSecret = db.settings.authProviders.discord?.clientSecret || process.env.DISCORD_CLIENT_SECRET || '';
    const newSecret = incoming.discord.clientSecret && !incoming.discord.clientSecret.includes('••••')
      ? incoming.discord.clientSecret
      : existingSecret;

    db.settings.authProviders.discord = { ...db.settings.authProviders.discord, ...incoming.discord, clientSecret: newSecret };
  }

  saveDbSync();

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'ADMIN_UPDATE_AUTH_PROVIDERS', 'SECURITY',
    'Updated authentication provider settings (Google Firebase, Discord OAuth, Email/Password)'
  );

  const currentRedirectUri = getDiscordOAuthRedirectUri(req, db.settings);
  const responseData = {
    ...db.settings.authProviders,
    discord: { ...db.settings.authProviders.discord, redirectUri: currentRedirectUri }
  };

  res.json({ success: true, message: 'Authentication providers updated successfully.', data: responseData });
});

// POST /api/v1/admin/auth-providers/test-google
router.post('/auth-providers/test-google', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const googleConfig: any = db.settings.authProviders?.google || {};
  const apiKey = googleConfig.firebaseApiKey || process.env.VITE_FIREBASE_API_KEY || '';
  const projectId = googleConfig.firebaseProjectId || process.env.VITE_FIREBASE_PROJECT_ID || '';
  const authDomain = googleConfig.firebaseAuthDomain || process.env.VITE_FIREBASE_AUTH_DOMAIN || '';

  const isConfigured = Boolean(apiKey && projectId && authDomain);

  if (!isConfigured) {
    return res.json({
      success: true,
      data: {
        status: 'NOT_CONFIGURED',
        message: 'BLOCKED — MISSING PRODUCTION CREDENTIALS',
        requiredConfig: ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_APP_ID'],
        lastCheck: new Date().toISOString()
      }
    });
  }

  res.json({
    success: true,
    data: { status: 'CONFIGURED', message: `Firebase Google Auth configured for project '${projectId}'.`, requiredConfig: [], lastCheck: new Date().toISOString() }
  });
});

// POST /api/v1/admin/auth-providers/test-discord
router.post('/auth-providers/test-discord', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const discordConfig: any = db.settings.authProviders?.discord || {};
  const clientId = discordConfig.clientId || process.env.DISCORD_CLIENT_ID || '';
  const clientSecret = discordConfig.clientSecret || process.env.DISCORD_CLIENT_SECRET || '';
  const redirectUri = getDiscordOAuthRedirectUri(req, db.settings);

  const isConfigured = Boolean(clientId && clientSecret && redirectUri && !clientSecret.includes('••••'));

  if (!isConfigured) {
    return res.json({
      success: true,
      data: {
        status: 'NOT_CONFIGURED',
        message: 'BLOCKED — MISSING PRODUCTION CREDENTIALS',
        requiredConfig: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'],
        lastCheck: new Date().toISOString()
      }
    });
  }

  res.json({
    success: true,
    data: { status: 'CONFIGURED', message: `Discord OAuth configured. Dynamic Redirect URI: ${redirectUri}`, requiredConfig: [], lastCheck: new Date().toISOString() }
  });
});

// POST /api/v1/admin/discord-bot/test
router.post('/discord-bot/test', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const botToken = process.env.DISCORD_BOT_TOKEN || db.settings.discordSettings?.botToken || '';

  if (!botToken) {
    return res.json({
      success: true,
      data: {
        status: 'NOT_CONFIGURED',
        message: 'Discord Bot Gateway: NOT CONFIGURED (Bot Token & Guild ID required)',
        requiredConfig: ['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID'],
        lastCheck: new Date().toISOString()
      }
    });
  }

  res.json({
    success: true,
    data: { status: 'CONFIGURED', message: 'Discord Bot Gateway configured and active.', requiredConfig: [], lastCheck: new Date().toISOString() }
  });
});

// GET /api/v1/admin/anti-abuse
router.get('/anti-abuse', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const antiAbuse = db.settings.antiAbuse || {
    enabled: false, provider: 'proxycheck', apiKey: '',
    blockVpn: true, blockProxy: true, blockTor: true, blockDatacenter: false,
    maxRiskScore: 65, maxRegistrationsPerIpPerDay: 2, loginLockoutMaxAttempts: 5, loginLockoutDurationSec: 300
  };

  res.json({
    success: true,
    data: { ...antiAbuse, apiKey: antiAbuse.apiKey ? '••••••••••••••••' : (process.env.VPN_CHECK_API_KEY ? '••••••••••••••••' : '') }
  });
});

// PUT /api/v1/admin/anti-abuse
router.put('/anti-abuse', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const db = await getDb();
  const incoming = req.body || {};
  const existingApiKey = db.settings.antiAbuse?.apiKey || process.env.VPN_CHECK_API_KEY || '';
  const newApiKey = incoming.apiKey && !incoming.apiKey.includes('••••') ? incoming.apiKey : existingApiKey;

  db.settings.antiAbuse = {
    enabled: incoming.enabled ?? false,
    provider: incoming.provider || 'proxycheck',
    apiKey: newApiKey,
    blockVpn: incoming.blockVpn ?? true,
    blockProxy: incoming.blockProxy ?? true,
    blockTor: incoming.blockTor ?? true,
    blockDatacenter: incoming.blockDatacenter ?? false,
    maxRiskScore: typeof incoming.maxRiskScore === 'number' ? incoming.maxRiskScore : 65,
    maxRegistrationsPerIpPerDay: typeof incoming.maxRegistrationsPerIpPerDay === 'number' ? incoming.maxRegistrationsPerIpPerDay : 2,
    loginLockoutMaxAttempts: typeof incoming.loginLockoutMaxAttempts === 'number' ? incoming.loginLockoutMaxAttempts : 5,
    loginLockoutDurationSec: typeof incoming.loginLockoutDurationSec === 'number' ? incoming.loginLockoutDurationSec : 300
  };

  saveDbSync();

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'ADMIN_UPDATE_ANTI_ABUSE', 'SECURITY',
    `Updated Anti-Abuse security settings (Enabled: ${db.settings.antiAbuse.enabled}, Provider: ${db.settings.antiAbuse.provider})`
  );

  res.json({
    success: true,
    message: 'Anti-Abuse protection settings saved successfully.',
    data: { ...db.settings.antiAbuse, apiKey: db.settings.antiAbuse.apiKey ? '••••••••••••••••' : '' }
  });
});

// POST /api/v1/admin/anti-abuse/test
router.post('/anti-abuse/test', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const antiAbuse = db.settings.antiAbuse || { enabled: false };
  const result = await testIpRiskConnection(antiAbuse as any);
  res.json({ success: true, data: result });
});

// --- THEMES & APPEARANCE SYSTEM ---
// GET /api/v1/admin/theme-settings
router.get('/theme-settings', async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const defaults = {
    activeThemeId: 'golden', activeFontId: 'Plus Jakarta Sans', cardStyle: 'rounded-2xl',
    glowIntensity: 'vibrant', allowUserCustomization: true, backgroundBlur: 'none', backgroundOverlayOpacity: 75,
    assets: { logoUrl: '', faviconUrl: '', bgPatternUrl: '', bannerUrl: '', loginBgUrl: '' }
  };
  const themeSettings = {
    ...defaults,
    ...(db.settings.themeSettings || {}),
    assets: { ...defaults.assets, ...(db.settings.themeSettings?.assets || {}) }
  };

  res.json({ success: true, data: themeSettings });
});

// PUT /api/v1/admin/theme-settings
router.put('/theme-settings', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const db = await getDb();
  const existingAssets = db.settings.themeSettings?.assets || {};
  db.settings.themeSettings = {
    ...db.settings.themeSettings,
    ...req.body,
    assets: { ...existingAssets, ...(req.body.assets || {}) }
  };
  saveDbSync();

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'ADMIN_UPDATE_THEME_SETTINGS', 'APPEARANCE',
    `Updated global theme settings (Theme: ${db.settings.themeSettings.activeThemeId}, Font: ${db.settings.themeSettings.activeFontId})`
  );

  res.json({ success: true, message: 'Global theme & appearance settings saved successfully.', data: db.settings.themeSettings });
});

// PUT /api/v1/admin/settings/appearance - Update animation settings
router.put('/settings/appearance', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin permissions required' } });
  }

  const db = await getDb();
  const { enabled, pageTransitions, initialPanelAnimation, intensity } = req.body;

  db.settings.animationSettings = {
    enabled: typeof enabled === 'boolean' ? enabled : true,
    pageTransitions: typeof pageTransitions === 'boolean' ? pageTransitions : true,
    initialPanelAnimation: typeof initialPanelAnimation === 'boolean' ? initialPanelAnimation : true,
    intensity: ['subtle', 'normal', 'enhanced'].includes(intensity) ? intensity : 'normal'
  };

  saveDbSync();

  await createAuditLog(
    req.user!.id, req.user!.email, req.user!.role,
    'ADMIN_UPDATE_ANIMATION_SETTINGS', 'APPEARANCE',
    `Updated animation settings (Enabled: ${db.settings.animationSettings.enabled}, Intensity: ${db.settings.animationSettings.intensity})`
  );

  res.json({ success: true, message: 'Animation settings updated successfully.', data: db.settings.animationSettings });
});

export default router;
