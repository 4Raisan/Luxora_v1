const ACTIVE_SUBSCRIPTION_STATUS = 'active';

async function loadSubscriptionUsage(client, userId) {
  const bookings = await client.booking.findMany({
    where: { userId, subscriptionId: { not: null }, status: { not: 'CANCELLED' } },
    select: { subscriptionId: true, service: { select: { categoryId: true } } },
  });
  const usage = new Map();
  for (const booking of bookings) {
    const key = `${booking.subscriptionId}:${booking.service.categoryId}`;
    usage.set(key, (usage.get(key) || 0) + 1);
  }
  return usage;
}

async function loadActiveSubscriptions(client, userId) {
  return client.userSubscription.findMany({
    where: { userId, status: ACTIVE_SUBSCRIPTION_STATUS, endDate: { gt: new Date() } },
    include: {
      entitlements: { include: { category: true } },
      plan: { include: { entitlements: { include: { category: true } } } },
    },
    orderBy: { startDate: 'desc' },
  });
}

function getEffectiveSubscriptionData(subscription) {
  const entitlements = subscription.entitlements && subscription.entitlements.length > 0
    ? subscription.entitlements
    : (subscription.plan?.entitlements || []);
  const planTitle = subscription.planTitle || subscription.plan?.title || 'Subscription Package';
  const price = subscription.pricePaid || subscription.plan?.priceMonthly || 0;
  return { entitlements, planTitle, price };
}

export async function getEntitlementSnapshot(client, userId) {
  const [subscriptions, usage] = await Promise.all([
    loadActiveSubscriptions(client, userId),
    loadSubscriptionUsage(client, userId),
  ]);
  const byCategory = new Map();

  for (const subscription of subscriptions) {
    const { entitlements, planTitle, price } = getEffectiveSubscriptionData(subscription);
    for (const entitlement of entitlements) {
      const used = usage.get(`${subscription.id}:${entitlement.categoryId}`) || 0;
      const existing = byCategory.get(entitlement.categoryId) || {
        category_id: entitlement.categoryId,
        category_name: entitlement.category.name,
        category_icon: entitlement.category.icon || null,
        entitled_units: 0,
        used_units: 0,
        remaining_units: 0,
        subscriptions: [],
      };
      existing.entitled_units += entitlement.units;
      existing.used_units += used;
      existing.remaining_units = Math.max(0, existing.entitled_units - existing.used_units);
      existing.subscriptions.push({
        subscription_id: subscription.id,
        plan_id: subscription.planId,
        plan_title: planTitle,
        price_monthly: price,
        currency: subscription.currency || 'LKR',
        units: entitlement.units,
        used_units: used,
        remaining_units: Math.max(0, entitlement.units - used),
        start_date: subscription.startDate,
        end_date: subscription.endDate,
      });
      byCategory.set(entitlement.categoryId, existing);
    }
  }

  return [...byCategory.values()];
}

export async function findBookableEntitlement(client, userId, categoryId) {
  const [subscriptions, usage] = await Promise.all([
    loadActiveSubscriptions(client, userId),
    loadSubscriptionUsage(client, userId),
  ]);

  for (const subscription of subscriptions) {
    const { entitlements, planTitle } = getEffectiveSubscriptionData(subscription);
    const entitlement = entitlements.find((item) => item.categoryId === categoryId);
    if (!entitlement) continue;
    const used = usage.get(`${subscription.id}:${categoryId}`) || 0;
    if (used < entitlement.units) {
      return {
        subscriptionId: subscription.id,
        planId: subscription.planId,
        planTitle: planTitle,
        categoryId,
        remainingUnits: entitlement.units - used,
      };
    }
  }
  return null;
}
