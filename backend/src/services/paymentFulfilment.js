// Shared post-payment fulfilment used by every gateway (PayHere,
// NOWPayments, Demo). Provider-specific handshake logic lives in each
// gateway's own route/service — nothing here calls a payment provider.
import { prisma } from '../config/prisma.js';
import { notify } from './notify.js';
import { sendEmail } from './integrations.js';
import { getEntitlementSnapshot } from './entitlements.js';

// Core subscription activation for an existing payment row. Runs with the
// provided Prisma client so it can join an outer transaction (Demo checkout)
// or the internal Serializable transaction below (PayHere/NOWPayments).
// Returns the completed payment with plan + subscription, or null when the
// payment is not in a PENDING state (already settled or refunded).
export async function activateSubscriptionInTx(tx, payment, payload = {}, { capturedAmount, capturedCurrency, autoRenew = false } = {}) {
  const fresh = await tx.payment.findUnique({ where: { id: payment.id }, include: { plan: { include: { entitlements: true } } } });
  if (!fresh || fresh.status === 'COMPLETED') return null;
  if (fresh.status !== 'PENDING') return null;
  const days = fresh.plan.durationDays || 30;
  const endDate = new Date(Date.now() + days * 86400000);
  const contractualPrice = Number(fresh.expectedAmount ?? fresh.plan.priceMonthly);
  const contractualCurrency = 'LKR';
  const finalCapturedAmount = Number(capturedAmount ?? payload.payhere_amount ?? payload.price_amount ?? fresh.expectedAmount);
  const finalCapturedCurrency = String(capturedCurrency ?? payload.payhere_currency ?? payload.price_currency ?? fresh.expectedCurrency).toUpperCase();
  const subscription = await tx.userSubscription.create({
    data: {
      userId: fresh.userId,
      planId: fresh.planId,
      planTitle: fresh.plan.title,
      planType: fresh.plan.type,
      pricePaid: contractualPrice,
      currency: contractualCurrency,
      durationDays: days,
      endDate,
      status: 'active',
      autoRenew,
      renewalIntervalDays: days,
      nextRenewalDate: endDate,
      entitlements: {
        create: (fresh.plan.entitlements || []).map((e) => ({
          categoryId: e.categoryId,
          units: e.units,
        })),
      },
    },
  });
  return tx.payment.update({
    where: { id: fresh.id },
    data: {
      status: 'COMPLETED',
      capturedAmount: finalCapturedAmount,
      capturedCurrency: finalCapturedCurrency,
      webhookPayload: {
        ...(typeof fresh.webhookPayload === 'object' && fresh.webhookPayload ? fresh.webhookPayload : {}),
        ...payload,
        settledAt: new Date().toISOString(),
      },
      subscriptionId: subscription.id,
    },
    include: { plan: { include: { entitlements: true } }, subscription: true },
  });
}

// Gateway-neutral activation used by the PayHere webhook and the NOWPayments
// IPN: serializes the settlement in its own Serializable transaction with a
// bounded retry so concurrent gateway callbacks cannot double-activate.
export async function activateSubscription(payment, payload = {}, { capturedAmount, capturedCurrency, autoRenew = false } = {}) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        return activateSubscriptionInTx(tx, payment, payload, { capturedAmount, capturedCurrency, autoRenew });
      }, { maxWait: 5000, timeout: 15000, isolationLevel: 'Serializable' });
    } catch (err) {
      const isConflict = err.code === 'P2034' || err.message?.includes('write conflict') || err.message?.includes('could not serialize access') || err.message?.includes('deadlock');
      if (isConflict) {
        await new Promise((r) => setTimeout(r, 100 * attempt));
        const current = await prisma.payment.findUnique({ where: { id: payment.id } });
        if (current?.status === 'COMPLETED') return null;
        if (attempt === maxAttempts) return null;
        continue;
      }
      throw err;
    }
  }
}

function buildReceiptHtml({ user, payment, coinsGranted, providerName, displayAmount, conversionInfo }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #0b0b0d; color: #d4af37; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; letter-spacing: 2px;">LUXORA</h1>
        <p style="margin: 4px 0 0; font-size: 12px; text-transform: uppercase; color: #bbb;">The Gold Standard of Modern Living</p>
      </div>
      <div style="padding: 24px 28px;">
        <h2 style="margin-top: 0; color: #0b0b0d; font-size: 18px;">Payment Receipt</h2>
        <p>Hi <strong>${user?.name || 'Customer'}</strong>,</p>
        <p>Thank you for your payment. Your subscription to <strong>${payment.plan?.title || 'Luxora Package'}</strong> is now active.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Order ID:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${payment.gatewayOrderId}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Plan / Service:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${payment.plan?.title || 'Package'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Amount:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #0b0b0d;">${payment.expectedCurrency} ${displayAmount}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Payment Gateway:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${providerName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Transaction Reference:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${payment.webhookPayload?.payment_id || payment.webhookPayload?.nowpayments_payment_id || payment.gatewayOrderId}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Payment Status:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #16a34a;">PAID / COMPLETED</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Service Coins Added:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #b45309;">+${coinsGranted} coins</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color: #666;">Subscription Valid Until:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${payment.subscription?.endDate ? payment.subscription.endDate.toISOString().slice(0, 10) : 'Active'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Date / Time:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${new Date().toUTCString()}</td>
          </tr>
        </table>

        ${conversionInfo}

        <p style="margin-top: 24px; font-size: 13px; color: #666;">You can view and manage your active entitlements anytime in your <a href="${process.env.FRONTEND_URL || 'https://luxora.bond'}/customer-dashboard" style="color: #d4af37; text-decoration: none; font-weight: bold;">Customer Dashboard</a>.</p>
      </div>
      <div style="background-color: #f9f9f9; padding: 12px 24px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee;">
        Luxora Home Concierge — Automated Transaction Notification
      </div>
    </div>
  `;
}

// Provider-labelled receipt, notification, and email delivery state for a
// settled payment. Shared by every gateway; never talks to a provider.
export async function completePaymentExperience(payment, mode) {
  const coinsGranted = Array.isArray(payment.plan?.entitlements)
    ? payment.plan.entitlements.reduce((total, entitlement) => total + entitlement.units, 0)
    : 0;

  const [entitlements, user] = await Promise.all([
    getEntitlementSnapshot(prisma, payment.userId),
    prisma.user.findUnique({ where: { id: payment.userId }, select: { email: true, name: true } }),
    notify(payment.userId, `${mode === 'demo' ? 'Demo ' : ''}payment successful. Your ${payment.plan?.title || 'package'} is active with ${coinsGranted} service coin${coinsGranted === 1 ? '' : 's'}.`, '/customer-dashboard'),
  ]);

  const providerName = mode === 'nowpayments' ? 'NOWPayments (Cryptocurrency)' : mode === 'payhere' ? 'PayHere' : 'Demo Payment';
  const displayAmount = Number(payment.expectedAmount).toLocaleString();
  const conversionInfo = payment.webhookPayload?.conversion
    ? `<p style="margin:4px 0;color:#666;font-size:13px;">Converted Crypto Invoice: <strong>$${payment.webhookPayload.conversion.convertedAmount} ${payment.webhookPayload.conversion.convertedCurrency}</strong> (Rate: 1 USD = ${payment.webhookPayload.conversion.exchangeRate} LKR)</p>`
    : '';

  const html = buildReceiptHtml({ user, payment, coinsGranted, providerName, displayAmount, conversionInfo });

  let emailDelivery = 'not_configured';
  let emailError = null;
  let resendMessageId = null;

  try {
    const result = await sendEmail({
      to: user?.email,
      subject: `Luxora Payment Confirmation & Receipt — ${payment.plan?.title || 'Luxora Package'}`,
      html,
    });
    if (result.configured) {
      emailDelivery = 'sent';
      resendMessageId = result.id || null;
    }
  } catch (error) {
    emailDelivery = 'failed';
    emailError = error.message;
    console.warn('[email] payment receipt failed:', error.message);
  }

  // Update payment record with receipt delivery status for full idempotency and retryability
  try {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        webhookPayload: {
          ...(typeof payment.webhookPayload === 'object' && payment.webhookPayload ? payment.webhookPayload : {}),
          receipt: {
            status: emailDelivery,
            recipient: user?.email || null,
            attemptedAt: new Date().toISOString(),
            resendId: resendMessageId,
            error: emailError,
          },
        },
      },
    });
  } catch (dbErr) {
    console.warn('[payment] could not persist receipt delivery state:', dbErr.message);
  }

  return {
    entitlement_snapshot: entitlements,
    receipt: {
      payment_id: payment.id,
      plan_id: payment.planId,
      plan_title: payment.plan?.title,
      amount: Number(payment.expectedAmount),
      currency: payment.expectedCurrency,
      coins_granted: coinsGranted,
      subscription_id: payment.subscription?.id,
      active_until: payment.subscription?.endDate,
      provider: providerName,
    },
    email_delivery: emailDelivery,
  };
}

export { buildReceiptHtml };
