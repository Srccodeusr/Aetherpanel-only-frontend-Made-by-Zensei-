/**
 * Provisioning Service
 * ---------------------
 * Runs after a checkout completes (paid or free-plan). Orchestrates:
 *   1. Create (or reuse) the customer's account on the external panel
 *   2. Look up the egg mapped to the purchased product's category
 *   3. If that egg exists in the panel -> create the server, mark completed
 *   4. If it doesn't (not configured yet, wrong ID, panel egg deleted) ->
 *      mark 'awaiting_manual_setup' so an admin can finish it by hand
 *
 * This runs asynchronously after the checkout HTTP response has already
 * been sent — the frontend polls GET /billing/provision/:id and drives its
 * loading screen off the `status` field written here at each step.
 */

import { getDb, saveDbSync } from '../db';
import { Order, Plan, Product, ProvisionRecord, ProvisionStatus, User } from '../../src/types';
import {
  createPanelServer,
  createPanelUser,
  findPanelUserByEmail,
  generateSecurePassword,
  getEgg,
  PanelApiError,
  sanitizePanelUsername
} from './panelService';
import { setEphemeralSecret } from './ephemeralSecrets';

function panelPasswordKey(provisionId: string): string {
  return `panel_pw:${provisionId}`;
}

async function updateProvision(id: string, patch: Partial<ProvisionRecord>): Promise<void> {
  const db = await getDb();
  const record = db.provisions.find(p => p.id === id);
  if (!record) return;
  Object.assign(record, patch, { updatedAt: new Date().toISOString() });
  saveDbSync();
}

export async function createProvisionRecord(order: Order, user: User, plan: Plan, product: Product): Promise<ProvisionRecord> {
  const db = await getDb();
  const record: ProvisionRecord = {
    id: `prov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orderId: order.id,
    userId: user.id,
    userEmail: user.email,
    planId: plan.id,
    planName: plan.name,
    productId: product.id,
    productName: product.name,
    status: 'pending',
    message: 'Order received. Preparing to set up your service...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.provisions.unshift(record);
  if (db.provisions.length > 2000) db.provisions = db.provisions.slice(0, 2000);
  saveDbSync();
  return record;
}

/**
 * Fire-and-forget entry point. Never throws — all failure paths resolve by
 * writing a 'failed' or 'awaiting_manual_setup' status onto the record.
 */
export async function runProvisioning(provisionId: string): Promise<void> {
  try {
    await doRunProvisioning(provisionId);
  } catch (err: any) {
    await updateProvision(provisionId, {
      status: 'failed',
      message: 'Something went wrong while setting up your service.',
      errorMessage: err?.message || 'Unknown error'
    });
  }
}

async function doRunProvisioning(provisionId: string): Promise<void> {
  const db = await getDb();
  const record = db.provisions.find(p => p.id === provisionId);
  if (!record) return;

  const settings = db.settings.panelIntegration;
  if (!settings || !settings.enabled || !settings.panelUrl || !settings.apiKey) {
    // No panel linked — this is a fully valid configuration (pure billing, no automation).
    await updateProvision(provisionId, {
      status: 'completed',
      message: 'Your order is complete.'
    });
    return;
  }

  const user = db.users.find(u => u.id === record.userId);
  const plan = db.plans.find(p => p.id === record.planId);
  const product = db.products.find(p => p.id === record.productId);
  if (!user || !plan || !product) {
    await updateProvision(provisionId, { status: 'failed', message: 'Order could not be provisioned.', errorMessage: 'Missing user, plan, or product record.' });
    return;
  }

  const config = { panelUrl: settings.panelUrl, apiKey: settings.apiKey };

  // --- Step 1: panel account -------------------------------------------------
  let panelUserId = user.panelUserId;
  let panelUsername = user.panelUsername;

  if (!panelUserId && settings.autoCreateAccount) {
    await updateProvision(provisionId, { status: 'creating_account', message: 'Creating your hosting panel account...' });

    try {
      const existing = await findPanelUserByEmail(config, user.email);
      if (existing) {
        panelUserId = existing.id;
        panelUsername = existing.username;
      } else {
        const desiredUsername = sanitizePanelUsername(user.username || user.email.split('@')[0]);
        const password = generateSecurePassword();
        const created = await createPanelUser(config, {
          email: user.email,
          username: desiredUsername,
          firstName: user.displayName || user.username,
          lastName: 'Customer',
          password
        });
        panelUserId = created.id;
        panelUsername = created.username;
        // Plaintext password is intentionally kept OUT of data/db.json.
        setEphemeralSecret(panelPasswordKey(provisionId), password);
      }

      user.panelUserId = panelUserId;
      user.panelUsername = panelUsername;
      user.panelLinkedAt = new Date().toISOString();
      saveDbSync();
    } catch (err: any) {
      const msg = err instanceof PanelApiError ? err.message : (err?.message || 'Failed to create panel account.');
      await updateProvision(provisionId, { status: 'failed', message: 'We could not create your hosting panel account.', errorMessage: msg });
      return;
    }
  }

  if (!panelUserId) {
    // Auto-account-creation is turned off in settings and no linked account exists yet.
    await updateProvision(provisionId, {
      status: 'awaiting_manual_setup',
      message: 'Your order is confirmed. Our team will finish setting up your panel access shortly.'
    });
    return;
  }

  if (!settings.autoCreateServer) {
    await updateProvision(provisionId, {
      status: 'completed',
      message: 'Your account is ready.',
      panelUserId,
      panelUsername,
      panelUrl: settings.panelUrl
    });
    return;
  }

  // --- Step 2: verify the egg mapped to this product's category exists -------
  await updateProvision(provisionId, {
    status: 'creating_server',
    message: 'Provisioning your server...',
    panelUserId,
    panelUsername,
    panelUrl: settings.panelUrl
  });

  const nestId = product.panelNestId;
  const eggId = product.panelEggId;

  if (!nestId || !eggId) {
    await updateProvision(provisionId, {
      status: 'awaiting_manual_setup',
      message: 'Your account is ready. Your server is being finished manually by our team and will appear in your panel shortly.'
    });
    return;
  }

  let egg;
  try {
    egg = await getEgg(config, nestId, eggId);
  } catch (err: any) {
    const msg = err instanceof PanelApiError ? err.message : (err?.message || 'Failed to reach the panel.');
    await updateProvision(provisionId, { status: 'failed', message: 'We could not verify your server template with the panel.', errorMessage: msg });
    return;
  }

  if (!egg) {
    // "if there is the egg in the panel" — it isn't (bad/missing mapping), so fall back gracefully.
    await updateProvision(provisionId, {
      status: 'awaiting_manual_setup',
      message: 'Your account is ready. Your server is being finished manually by our team and will appear in your panel shortly.'
    });
    return;
  }

  // --- Step 3: create the server ---------------------------------------------
  const locationIds = (product.panelLocationIds && product.panelLocationIds.length > 0)
    ? product.panelLocationIds
    : (settings.defaultLocationIds || []);

  if (locationIds.length === 0) {
    await updateProvision(provisionId, {
      status: 'awaiting_manual_setup',
      message: 'Your account is ready. No deploy location is configured yet, so our team will finish setting up your server shortly.'
    });
    return;
  }

  try {
    const environment = { ...egg.environment, ...(product.panelEnvironment || {}) };
    const server = await createPanelServer(config, {
      name: `${user.username}-${plan.name}`.slice(0, 60),
      userId: panelUserId,
      eggId,
      dockerImage: product.panelDockerImage || egg.dockerImage,
      startup: product.panelStartupCommand || egg.startup,
      environment,
      memoryMB: plan.ramMB,
      diskMB: plan.diskGB * 1024,
      cpuPercent: Math.round(plan.cpuCores * 100),
      databases: plan.databaseLimit,
      backups: plan.backupLimit,
      locationIds,
      startOnCompletion: settings.startServerOnCompletion
    });

    await updateProvision(provisionId, {
      status: 'completed',
      message: 'Your server is ready!',
      panelServerId: server.id,
      panelServerIdentifier: server.identifier,
      panelServerName: server.name
    });
  } catch (err: any) {
    const msg = err instanceof PanelApiError ? err.message : (err?.message || 'Failed to create the server.');
    await updateProvision(provisionId, {
      status: 'awaiting_manual_setup',
      message: 'Your account is ready. Automatic server setup hit a snag, so our team will finish it manually.',
      errorMessage: msg
    });
  }
}
