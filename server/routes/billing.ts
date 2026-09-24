import { Router, Response } from 'express';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, createAuditLog, AuthenticatedRequest } from '../auth';
import { createProvisionRecord, runProvisioning } from '../services/provisioningService';
import { peekEphemeralSecret } from '../services/ephemeralSecrets';
import { Order } from '../../src/types';

const router = Router();

// GET /api/v1/billing/orders
router.get('/orders', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userOrders = db.orders.filter(o => o.userId === req.user!.id);
  res.json({ success: true, data: userOrders });
});

// POST /api/v1/billing/coupons/validate - Check a coupon without redeeming it
router.post('/coupons/validate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, error: { code: 'CODE_REQUIRED', message: 'Coupon code required' } });

  const db = await getDb();
  const coupon = db.coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase() && c.isActive);

  if (!coupon) {
    return res.status(404).json({ success: false, error: { code: 'INVALID_COUPON', message: 'Invalid or expired promotional code.' } });
  }

  if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
    return res.status(400).json({ success: false, error: { code: 'COUPON_EXHAUSTED', message: 'Promotional code has reached its maximum usage limit.' } });
  }

  res.json({
    success: true,
    data: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue }
  });
});

// POST /api/v1/billing/redeem-coupon - Validate and apply a coupon to the user's account credits
router.post('/redeem-coupon', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, error: { code: 'CODE_REQUIRED', message: 'Coupon code required' } });
  }

  const db = await getDb();
  const coupon = db.coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase() && c.isActive);

  if (!coupon) {
    return res.status(404).json({ success: false, error: { code: 'INVALID_COUPON', message: 'Invalid or expired promotional code.' } });
  }

  if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
    return res.status(400).json({ success: false, error: { code: 'COUPON_EXHAUSTED', message: 'Promotional code has reached its maximum usage limit.' } });
  }

  const user = db.users.find(u => u.id === req.user!.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  // Fixed-value coupons are applied directly as account credits.
  // Percent coupons have no purchase to discount here, so they are validated but not auto-applied as credits.
  if (coupon.discountType === 'fixed') {
    user.credits = parseFloat((user.credits + coupon.discountValue).toFixed(2));
    coupon.timesUsed = (coupon.timesUsed || 0) + 1;
    user.updatedAt = new Date().toISOString();
    saveDbSync();

    await createAuditLog(user.id, user.email, user.role, 'COUPON_REDEEMED', coupon.id, `Redeemed coupon '${coupon.code}' for $${coupon.discountValue.toFixed(2)} credits`);

    return res.json({
      success: true,
      message: `Coupon redeemed! $${coupon.discountValue.toFixed(2)} added to your account credits.`,
      data: { newBalance: user.credits, coupon: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue } }
    });
  }

  res.json({
    success: true,
    message: `Coupon '${coupon.code}' is valid for ${coupon.discountValue}% off at checkout.`,
    data: { coupon: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue } }
  });
});

// GET /api/v1/billing/payment-methods
router.get('/payment-methods', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({
    success: true,
    data: db.settings.paymentGateways || {
      upi: { enabled: false, upiId: '', merchantName: '', qrCodeUrl: '', instructions: '' },
      bank: { enabled: false, bankName: '', accountNumber: '', ifsc: '', accountHolder: '', instructions: '' },
      crypto: { enabled: false, walletAddress: '', network: '', instructions: '' },
      stripe: { enabled: false, instructions: '' },
      giftCard: { enabled: false, amazonEnabled: false, amazonInstructions: '', playStoreEnabled: false, playStoreInstructions: '' }
    }
  });
});

// POST /api/v1/billing/add-credits
router.post('/add-credits', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { amount, paymentMethod, transactionRef, proofUrl, methodType, giftCardType } = req.body;
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount < 1) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Minimum deposit amount is $1.00.' } });
  }

  const db = await getDb();
  const user = db.users.find(u => u.id === req.user!.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  // Normalize which "kind" of method this is so manual methods (which need
  // staff approval before crediting) are detected reliably — whether the
  // client sends a machine key (methodType) or only the display label
  // (paymentMethod, e.g. "UPI / QR Code", "Gift Card - Amazon").
  const normalizedType = String(methodType || '').toLowerCase();
  const normalizedLabel = String(paymentMethod || '').toLowerCase();
  const isGiftCard = normalizedType === 'giftcard' || normalizedLabel.includes('gift card');
  const isManualMethod = isGiftCard
    || ['upi', 'qr_code', 'bank', 'crypto'].includes(normalizedType)
    || normalizedLabel.includes('upi')
    || normalizedLabel.includes('bank')
    || normalizedLabel.includes('crypto');

  const resolvedGiftCardType: 'amazon' | 'playstore' | undefined = isGiftCard
    ? (giftCardType === 'playstore' ? 'playstore' : 'amazon')
    : undefined;

  if (isManualMethod && !transactionRef) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'REF_REQUIRED',
        message: isGiftCard
          ? 'Please enter the gift card code before submitting.'
          : 'Please provide Transaction Reference / UTR Number after completing payment.'
      }
    });
  }

  // Manual methods (UPI, Bank, Crypto, Gift Card) always land as 'pending' —
  // a staff member has to verify the reference/code and approve it
  // (see POST /admin/orders/:id/approve) before credits are added.
  const orderStatus = isManualMethod ? 'pending' : 'paid';

  if (orderStatus === 'paid') {
    user.credits = parseFloat((user.credits + numAmount).toFixed(2));
  }

  const order = {
    id: `ord_${Date.now()}`,
    userId: user.id,
    userEmail: user.email,
    planId: 'credit_deposit',
    planName: 'Account Credits Deposit',
    billingCycle: 'monthly' as const,
    amount: numAmount,
    currency: db.settings.currencyCode || 'USD',
    status: orderStatus as 'paid' | 'pending',
    paymentMethod: paymentMethod || 'Instant Card',
    transactionRef: transactionRef || undefined,
    giftCardType: resolvedGiftCardType,
    proofUrl: proofUrl || undefined,
    createdAt: new Date().toISOString()
  };

  db.orders.unshift(order);
  saveDbSync();

  if (orderStatus === 'pending') {
    return res.json({
      success: true,
      message: isGiftCard
        ? `Gift card code submitted for verification! Our team will verify it and credit $${numAmount.toFixed(2)} to your balance once approved.`
        : `Payment submitted for verification! Transaction Ref: ${transactionRef}. Admin will verify and credit $${numAmount.toFixed(2)} shortly.`,
      data: { newBalance: user.credits, order }
    });
  }

  res.json({
    success: true,
    message: `Successfully added $${numAmount.toFixed(2)} to account credits balance.`,
    data: { newBalance: user.credits, order }
  });
});

// POST /api/v1/billing/checkout - Purchase a plan (or claim a free plan). Pay
// with account credits (instant — provisioning starts immediately), or a
// Gift Card code (goes to pending; a staff member verifies the code from
// Admin > Pending Orders, and approving it is what actually starts
// provisioning — see POST /admin/orders/:id/approve). No credits are touched
// on the gift card path.
router.post('/checkout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const {
    planId, billingCycle, couponCode, serverName, serverDescription,
    selectedEggOptionId, selectedLocationOptionId,
    paymentMethod, giftCardType, transactionRef
  } = req.body || {};

  if (!planId) {
    return res.status(400).json({ success: false, error: { code: 'PLAN_REQUIRED', message: 'A plan is required to check out.' } });
  }
  const cycle: 'monthly' | 'yearly' = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const isGiftCard = String(paymentMethod || '').toLowerCase() === 'giftcard';

  if (isGiftCard && !transactionRef) {
    return res.status(400).json({ success: false, error: { code: 'REF_REQUIRED', message: 'Please enter the gift card code before submitting.' } });
  }

  const db = await getDb();
  const plan = db.plans.find(p => p.id === planId && p.isActive);
  if (!plan) {
    return res.status(404).json({ success: false, error: { code: 'PLAN_NOT_FOUND', message: 'That plan is not available.' } });
  }
  const product = db.products.find(p => p.id === plan.productId);
  if (!product) {
    return res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'That plan has no associated product.' } });
  }

  // --- Resolve/validate the customer's deployment choices against what this
  // product actually offers. Auto-resolved when there's only one option;
  // required from the client when there's more than one; skipped entirely
  // when the product has none configured (falls back to manual setup later).
  const eggOptions = product.panelEggOptions || [];
  let resolvedEggOptionId: string | undefined;
  if (eggOptions.length > 1) {
    const match = eggOptions.find(o => o.id === selectedEggOptionId);
    if (!match) {
      return res.status(400).json({ success: false, error: { code: 'EGG_OPTION_REQUIRED', message: 'Choose which application to deploy.' } });
    }
    resolvedEggOptionId = match.id;
  } else if (eggOptions.length === 1) {
    resolvedEggOptionId = eggOptions[0].id;
  }

  const locationOptions = product.panelLocationOptions || [];
  let resolvedLocationOptionId: string | undefined;
  if (locationOptions.length > 1) {
    const match = locationOptions.find(o => o.id === selectedLocationOptionId);
    if (!match) {
      return res.status(400).json({ success: false, error: { code: 'LOCATION_OPTION_REQUIRED', message: 'Choose a deploy location.' } });
    }
    resolvedLocationOptionId = match.id;
  } else if (locationOptions.length === 1) {
    resolvedLocationOptionId = locationOptions[0].id;
  }

  const trimmedServerName = typeof serverName === 'string' ? serverName.trim().slice(0, 60) : '';
  const trimmedServerDescription = typeof serverDescription === 'string' ? serverDescription.trim().slice(0, 250) : '';

  const user = db.users.find(u => u.id === req.user!.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  if (isGiftCard) {
    // Gift card orders don't create a provisioning record until approved, so
    // they can't be counted by the active-provisions check below — guard
    // separately against stacking up duplicate pending requests for the same plan.
    const alreadyPending = db.orders.some(o => o.userId === user.id && o.planId === plan.id && o.status === 'pending');
    if (alreadyPending) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_PENDING', message: `You already have a pending gift card order for '${plan.name}' awaiting verification.` }
      });
    }
  } else {
    // Enforce the plan's server-slot limit using this user's provisioning history for this plan.
    const activeStatuses = new Set(['pending', 'creating_account', 'creating_server', 'completed', 'awaiting_manual_setup']);
    const existingForPlan = db.provisions.filter(p => p.userId === user.id && p.planId === plan.id && activeStatuses.has(p.status)).length;
    if (plan.serverLimit && existingForPlan >= plan.serverLimit) {
      return res.status(400).json({
        success: false,
        error: { code: 'PLAN_LIMIT_REACHED', message: `You've already reached the server limit (${plan.serverLimit}) for the '${plan.name}' plan.` }
      });
    }
  }

  let price = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  let appliedCoupon: { code: string; discountType: 'percent' | 'fixed'; discountValue: number } | null = null;

  if (couponCode && couponCode.trim()) {
    const coupon = db.coupons.find(c => c.code.toUpperCase() === couponCode.trim().toUpperCase() && c.isActive);
    if (!coupon) {
      return res.status(404).json({ success: false, error: { code: 'INVALID_COUPON', message: 'Invalid or expired promotional code.' } });
    }
    if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
      return res.status(400).json({ success: false, error: { code: 'COUPON_EXHAUSTED', message: 'Promotional code has reached its maximum usage limit.' } });
    }
    price = coupon.discountType === 'percent'
      ? parseFloat((price * (1 - coupon.discountValue / 100)).toFixed(2))
      : Math.max(0, parseFloat((price - coupon.discountValue).toFixed(2)));
    coupon.timesUsed = (coupon.timesUsed || 0) + 1;
    appliedCoupon = { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue };
  }

  // --- Gift Card path: create a pending order for THIS plan and stop here —
  // no credits touched, no provisioning yet. Approving it from Admin >
  // Pending Orders is what actually grants the plan and starts provisioning.
  if (isGiftCard) {
    const order: Order = {
      id: `ord_${Date.now()}`,
      userId: user.id,
      userEmail: user.email,
      planId: plan.id,
      planName: plan.name,
      productId: product.id,
      billingCycle: cycle,
      amount: price,
      currency: db.settings.currencyCode || 'USD',
      status: 'pending',
      paymentMethod: `Gift Card - ${giftCardType === 'playstore' ? 'Google Play' : 'Amazon'}`,
      transactionRef,
      giftCardType: giftCardType === 'playstore' ? 'playstore' : 'amazon',
      adminNote: appliedCoupon ? `Coupon '${appliedCoupon.code}' applied (${appliedCoupon.discountType === 'percent' ? appliedCoupon.discountValue + '%' : '$' + appliedCoupon.discountValue} off)` : undefined,
      serverName: trimmedServerName || undefined,
      serverDescription: trimmedServerDescription || undefined,
      selectedEggOptionId: resolvedEggOptionId,
      selectedLocationOptionId: resolvedLocationOptionId,
      createdAt: new Date().toISOString()
    };
    db.orders.unshift(order);
    saveDbSync();

    await createAuditLog(user.id, user.email, user.role, 'PLAN_ORDER_SUBMITTED', order.id, `Submitted gift card order for plan '${plan.name}' (${cycle}), $${price.toFixed(2)} — awaiting staff verification`);

    return res.json({
      success: true,
      message: `Gift card code submitted! A staff member will verify it and set up '${plan.name}' once approved.`,
      data: { order, pendingApproval: true }
    });
  }

  if (price > 0 && user.credits < price) {
    return res.status(402).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_CREDITS',
        message: `You need $${price.toFixed(2)} in account credits for this plan, but your balance is $${user.credits.toFixed(2)}. Add $${(price - user.credits).toFixed(2)} more to continue.`
      }
    });
  }

  if (price > 0) {
    user.credits = parseFloat((user.credits - price).toFixed(2));
  }
  user.plan = plan.id;
  user.updatedAt = new Date().toISOString();

  const order: Order = {
    id: `ord_${Date.now()}`,
    userId: user.id,
    userEmail: user.email,
    planId: plan.id,
    planName: plan.name,
    productId: product.id,
    billingCycle: cycle,
    amount: price,
    currency: db.settings.currencyCode || 'USD',
    status: 'paid',
    paymentMethod: price > 0 ? 'Account Credits' : 'Free Plan',
    adminNote: appliedCoupon ? `Coupon '${appliedCoupon.code}' applied (${appliedCoupon.discountType === 'percent' ? appliedCoupon.discountValue + '%' : '$' + appliedCoupon.discountValue} off)` : undefined,
    provisionId: undefined,
    serverName: trimmedServerName || undefined,
    serverDescription: trimmedServerDescription || undefined,
    selectedEggOptionId: resolvedEggOptionId,
    selectedLocationOptionId: resolvedLocationOptionId,
    createdAt: new Date().toISOString()
  };
  db.orders.unshift(order);
  saveDbSync();

  await createAuditLog(user.id, user.email, user.role, 'PLAN_PURCHASED', order.id, `Purchased plan '${plan.name}' (${cycle}) for $${price.toFixed(2)}`);

  const provisionRecord = await createProvisionRecord(order, user, plan, product);
  order.provisionId = provisionRecord.id;
  saveDbSync();

  // Fire-and-forget: this performs the panel account + server creation and updates
  // the provision record as it goes. The client polls GET /billing/provision/:id.
  runProvisioning(provisionRecord.id).catch(() => { /* runProvisioning already handles its own errors */ });

  res.json({
    success: true,
    message: price > 0 ? `Payment of $${price.toFixed(2)} confirmed.` : 'Free plan activated.',
    data: { order, provisionId: provisionRecord.id, newBalance: user.credits }
  });
});

// GET /api/v1/billing/provision/:id - Poll provisioning status for the checkout loading screen
router.get('/provision/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const record = db.provisions.find(p => p.id === req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Provisioning record not found.' } });
  }

  const isOwner = record.userId === req.user!.id;
  const isStaff = ['admin', 'super_admin', 'support', 'moderator'].includes(req.user!.role);
  if (!isOwner && !isStaff) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this order.' } });
  }

  // The plaintext panel password (if one was generated) lives only in memory,
  // never on disk — see server/services/ephemeralSecrets.ts.
  const panelPassword = record.status === 'completed' ? peekEphemeralSecret(`panel_pw:${record.id}`) : null;

  res.json({
    success: true,
    data: {
      id: record.id,
      status: record.status,
      message: record.message,
      planName: record.planName,
      productName: record.productName,
      panelUrl: record.panelUrl,
      panelUsername: record.panelUsername,
      panelPassword: panelPassword || undefined,
      panelServerName: record.panelServerName,
      errorMessage: isStaff ? record.errorMessage : undefined,
      updatedAt: record.updatedAt
    }
  });
});

export default router;
