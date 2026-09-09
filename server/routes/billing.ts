import { Router, Response } from 'express';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, createAuditLog, AuthenticatedRequest } from '../auth';

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
      stripe: { enabled: false, instructions: '' }
    }
  });
});

// POST /api/v1/billing/add-credits
router.post('/add-credits', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { amount, paymentMethod, transactionRef, proofUrl } = req.body;
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount < 1) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Minimum deposit amount is $1.00.' } });
  }

  const db = await getDb();
  const user = db.users.find(u => u.id === req.user!.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  const isManualMethod = ['upi', 'qr_code', 'bank', 'crypto'].includes(paymentMethod?.toLowerCase());

  if (isManualMethod && !transactionRef) {
    return res.status(400).json({
      success: false,
      error: { code: 'REF_REQUIRED', message: 'Please provide Transaction Reference / UTR Number after completing payment.' }
    });
  }

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
    proofUrl: proofUrl || undefined,
    createdAt: new Date().toISOString()
  };

  db.orders.unshift(order);
  saveDbSync();

  if (orderStatus === 'pending') {
    return res.json({
      success: true,
      message: `Payment submitted for verification! Transaction Ref: ${transactionRef}. Admin will verify and credit $${numAmount.toFixed(2)} shortly.`,
      data: { newBalance: user.credits, order }
    });
  }

  res.json({
    success: true,
    message: `Successfully added $${numAmount.toFixed(2)} to account credits balance.`,
    data: { newBalance: user.credits, order }
  });
});

export default router;
