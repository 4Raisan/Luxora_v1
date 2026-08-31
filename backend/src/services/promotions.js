import { Prisma } from '@prisma/client';

export const activePromotionWhere = (now = new Date()) => ({
  active: true,
  AND: [
    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
    { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
  ],
});

export const calculatePromotionPrice = (price, discountPct = 0) => {
  const originalAmount = new Prisma.Decimal(price).toDecimalPlaces(2);
  const percentage = new Prisma.Decimal(discountPct || 0);
  const discountedAmount = originalAmount
    .minus(originalAmount.mul(percentage).div(100))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return {
    originalAmount,
    discountedAmount,
    discountAmount: originalAmount.minus(discountedAmount).toDecimalPlaces(2),
  };
};

// A promotion without package assignments is a catalogue-wide campaign.
// When more than one campaign applies, the highest percentage wins.
export async function findActivePromotionForPlan(client, planId, now = new Date()) {
  return client.promotion.findFirst({
    where: {
      ...activePromotionWhere(now),
      OR: [
        { planAssignments: { none: {} } },
        { planAssignments: { some: { planId } } },
      ],
    },
    orderBy: [{ discountPct: 'desc' }, { createdAt: 'desc' }],
  });
}

export const serializePromotion = (promotion) => (promotion ? {
  id: promotion.id,
  title: promotion.title,
  code: promotion.code,
  discountPct: Number(promotion.discountPct),
  discount_percent: Number(promotion.discountPct),
  startsAt: promotion.startsAt,
  starts_at: promotion.startsAt,
  endsAt: promotion.endsAt,
  ends_at: promotion.endsAt,
} : null);
