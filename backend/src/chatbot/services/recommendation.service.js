// Package recommendations are computed from the live admin-managed catalog
// (SubscriptionPlan + entitlements + active promotions). No plan name, price,
// or coin allocation is ever hardcoded here: if the catalog is empty or the
// database is unreachable the caller gets an honest "unavailable" result
// instead of fabricated numbers.

// Product coverage limits used by the sizing wizards (6 vehicles / 30 perches
// / 5 pets); anything beyond opens a Special Ask instead of a package match.
const LIMITS = { auto: 6, garden: 30, pet: 5 };

const CATEGORY_KEYS = {
  'Auto Care': 'auto',
  'Garden Care': 'garden',
  'Pet Care': 'pet',
};

function validateInputs({ cars = 0, perches = 0, pets = 0 }) {
  const errors = [];
  if (cars !== undefined && cars !== null) {
    if (isNaN(cars)) errors.push('Please enter a valid number of vehicles.');
    else if (cars < 0) errors.push('Number of vehicles cannot be negative.');
    else if (!Number.isInteger(Number(cars))) errors.push('Number of vehicles must be a whole number.');
  }
  if (pets !== undefined && pets !== null) {
    if (isNaN(pets)) errors.push('Please enter a valid number of pets.');
    else if (pets < 0) errors.push('Number of pets cannot be negative.');
    else if (!Number.isInteger(Number(pets))) errors.push('Number of pets must be a whole number.');
  }
  if (perches !== undefined && perches !== null) {
    if (isNaN(perches)) errors.push('Please enter a valid garden size in perches.');
    else if (perches < 0) errors.push('Garden size cannot be negative.');
  }
  return errors;
}

function formatPrice(amount) {
  return `LKR ${Number(amount).toLocaleString('en-US')}/month`;
}

// Monthly visit need derived from the customer's answers.
function needFor(categoryKey, { cars, perches, pets }) {
  if (categoryKey === 'auto') return Math.max(0, Number(cars) || 0);
  if (categoryKey === 'pet') return Math.max(0, Number(pets) || 0);
  if (categoryKey === 'garden') {
    const size = Math.max(0, Number(perches) || 0);
    if (size <= 0) return 0;
    if (size < 10) return 1;
    if (size <= 20) return 2;
    return 4;
  }
  return 0;
}

// Legacy plans may still carry the generic "Single Package" type, so the
// effective category falls back to the plan's single entitlement.
function classifyPlan(plan) {
  const type = String(plan.type || '').trim();
  if (CATEGORY_KEYS[type]) return CATEGORY_KEYS[type];
  if (/combo/i.test(type)) return 'combo';
  const categories = plan.units.map((unit) => unit.category).filter(Boolean);
  const unique = [...new Set(categories.map((name) => name.toLowerCase()))];
  if (unique.length === 1) return CATEGORY_KEYS[Object.keys(CATEGORY_KEYS).find((name) => name.toLowerCase() === unique[0])] || null;
  return unique.length > 1 ? 'combo' : null;
}

async function loadActivePlans(prisma) {
  const now = new Date();
  const [plans, promotions] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: { active: true },
      include: { entitlements: { include: { category: true } } },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    }),
    // Same promotion resolution as the public catalog endpoint: catalogue-wide
    // campaigns (no assignments) apply everywhere, assigned ones only to their
    // plans, and the highest percentage wins.
    prisma.promotion.findMany({
      where: {
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      include: { planAssignments: { select: { planId: true } } },
      orderBy: [{ discountPct: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  return plans.map((plan) => {
    const promotion = promotions.find(
      (candidate) => candidate.planAssignments.length === 0
        || candidate.planAssignments.some((assignment) => assignment.planId === plan.id)
    ) || null;
    const discountPct = promotion ? Number(promotion.discountPct) : 0;
    const price = Number(plan.priceMonthly);
    const discounted = discountPct > 0 ? Math.round(price * (100 - discountPct)) / 100 : price;
    return {
      id: plan.id,
      title: plan.title,
      type: plan.type,
      price,
      discounted,
      discountPct,
      units: (plan.entitlements || []).map((entitlement) => ({
        category: entitlement.category?.name || null,
        units: Number(entitlement.units) || 0,
      })),
    };
  }).map((plan) => ({ ...plan, categoryKey: classifyPlan(plan) }));
}

function unitsFor(plan, categoryName) {
  const unit = plan.units.find((item) => String(item.category || '').toLowerCase() === String(categoryName).toLowerCase());
  return unit ? unit.units : 0;
}

function featureLines(plan, categoryName) {
  const visits = unitsFor(plan, categoryName);
  const lines = visits > 0 ? [`${visits} ${categoryName} visit${visits === 1 ? '' : 's'} per month`] : [];
  return lines;
}

function buildCard(plan, { badge, why, categoryName }) {
  return {
    badge,
    name: plan.title,
    // Real subscription-plan identity so downstream flows (booking page
    // pre-selection, purchase) resolve the exact admin-managed DB record.
    planId: plan.id,
    planType: plan.categoryKey === 'combo' ? 'Combo Package' : (categoryName || plan.type),
    categoryKey: plan.categoryKey === 'combo' ? 'combo' : plan.categoryKey,
    price: formatPrice(plan.discounted),
    features: plan.categoryKey === 'combo'
      ? plan.units.map((unit) => `${unit.units} ${unit.category || 'Service'} visit${unit.units === 1 ? '' : 's'} / month`)
      : featureLines(plan, categoryName),
    why,
  };
}

function exceedsLimitResult(categoryKey, quantity, limitText) {
  return {
    exceedsLimit: true,
    categoryKey,
    categoryName: Object.keys(CATEGORY_KEYS).find((name) => CATEGORY_KEYS[name] === categoryKey),
    enteredQuantity: quantity,
    noticeTitle: 'Need something beyond our standard coverage?',
    noticeText: `Your requirement exceeds the standard service range (${limitText}). If you'd like Luxora to handle this, you can submit a Special Ask and our team will review your requirements individually.`,
    recommendations: [],
  };
}

async function getSimplifiedRecommendation(prisma, { cars = 0, perches = 0, pets = 0 } = {}) {
  const validationErrors = validateInputs({ cars, perches, pets });
  if (validationErrors.length > 0) {
    return { invalid: true, error: validationErrors.join(' '), recommendations: [] };
  }

  const numCars = Math.max(0, parseInt(cars, 10) || 0);
  const numPets = Math.max(0, parseInt(pets, 10) || 0);
  const numPerches = Math.max(0, parseFloat(perches) || 0);

  if (numCars > LIMITS.auto) return exceedsLimitResult('auto', `${numCars} vehicles`, `up to ${LIMITS.auto} vehicles`);
  if (numPets > LIMITS.pet) return exceedsLimitResult('pet', `${numPets} pets`, `up to ${LIMITS.pet} pets`);
  if (numPerches > LIMITS.garden) return exceedsLimitResult('garden', `${numPerches} perches`, `up to ${LIMITS.garden} perches`);

  if (numCars === 0 && numPerches === 0 && numPets === 0) {
    return {
      invalid: true,
      error: 'Tell me about at least one of your vehicles, garden size, or pets so I can recommend a package.',
      recommendations: [],
    };
  }

  let plans;
  try {
    plans = await loadActivePlans(prisma);
  } catch (error) {
    console.error('[chatbot] could not load plan catalog:', error.message);
    return { unavailable: true, recommendations: [] };
  }
  if (!plans.length) return { unavailable: true, recommendations: [] };

  const needs = {
    auto: needFor('auto', { cars: numCars }),
    garden: needFor('garden', { perches: numPerches }),
    pet: needFor('pet', { pets: numPets }),
  };
  const activeNeeds = Object.entries(needs).filter(([, need]) => need > 0);

  // Multi-service households: prefer a combo plan that covers every need.
  if (activeNeeds.length >= 2) {
    const combos = plans.filter((plan) => plan.categoryKey === 'combo');
    const scored = combos.map((plan) => {
      const shortfall = activeNeeds.reduce((total, [categoryKey, need]) => {
        const categoryName = Object.keys(CATEGORY_KEYS).find((name) => CATEGORY_KEYS[name] === categoryKey);
        return total + Math.max(0, need - unitsFor(plan, categoryName));
      }, 0);
      const excess = activeNeeds.reduce((total, [categoryKey, need]) => {
        const categoryName = Object.keys(CATEGORY_KEYS).find((name) => CATEGORY_KEYS[name] === categoryKey);
        return total + Math.max(0, unitsFor(plan, categoryName) - need);
      }, 0);
      return { plan, shortfall, excess };
    });

    const covering = scored.filter((item) => item.shortfall === 0)
      .sort((a, b) => a.excess - b.excess || a.plan.discounted - b.plan.discounted);
    const partial = scored.filter((item) => item.shortfall > 0)
      .sort((a, b) => a.shortfall - b.shortfall || a.plan.discounted - b.plan.discounted);

    if (covering.length > 0) {
      const needSummary = activeNeeds
        .map(([categoryKey, need]) => `${need} ${categoryKey} visit${need === 1 ? '' : 's'}`)
        .join(' + ');
      const recommendations = [buildCard(covering[0].plan, {
        badge: '⭐ Best Match',
        why: `One bundle covering your full monthly need: ${needSummary}.`,
      })];
      if (covering[1]) {
        recommendations.push(buildCard(covering[1].plan, {
          badge: 'Another good option',
          why: 'Also covers everything you need — compare the monthly coin split before choosing.',
        }));
      }
      return { exceedsLimit: false, recommendations };
    }

    // No combo covers everything (or none exists at all): offer the closest
    // combo if one exists, then the best single plan for each needed category.
    const recommendations = partial.length > 0 ? [buildCard(partial[0].plan, {
      badge: '⭐ Closest Combo',
      why: `Covers most of your needs, but falls short on ${partial[0].shortfall} visit${partial[0].shortfall === 1 ? '' : 's'} — make a Special Ask for the remainder.`,
    })] : [];
    const singleCards = activeNeeds.map(([categoryKey, need], index) => {
      const categoryName = Object.keys(CATEGORY_KEYS).find((name) => CATEGORY_KEYS[name] === categoryKey);
      const singles = plans.filter((plan) => plan.categoryKey === categoryKey)
        .sort((a, b) => unitsFor(a, categoryName) - unitsFor(b, categoryName) || a.discounted - b.discounted);
      const best = singles.find((plan) => unitsFor(plan, categoryName) >= need) || singles[singles.length - 1];
      if (!best) return null;
      return buildCard(best, {
        badge: index === 0 ? (recommendations.length === 0 ? '⭐ Best Match' : 'Separate plans option') : `For your ${categoryName.toLowerCase()}`,
        why: `A dedicated ${categoryName} plan sized for ${need} visit${need === 1 ? '' : 's'} per month.`,
        categoryName,
        need,
      });
    }).filter(Boolean);
    return { exceedsLimit: false, recommendations: [...recommendations, ...singleCards].slice(0, 3) };
  }

  // Single-service need: pick the smallest plan that covers it.
  const [categoryKey, need] = activeNeeds[0];
  const categoryName = Object.keys(CATEGORY_KEYS).find((name) => CATEGORY_KEYS[name] === categoryKey);
  const candidates = plans.filter((plan) => plan.categoryKey === categoryKey)
    .sort((a, b) => unitsFor(a, categoryName) - unitsFor(b, categoryName) || a.discounted - b.discounted);

  if (candidates.length === 0) {
    return { exceedsLimit: false, recommendations: [] };
  }

  const covering = candidates.filter((plan) => unitsFor(plan, categoryName) >= need);
  const recommendations = [];

  if (covering.length > 0) {
    recommendations.push(buildCard(covering[0], {
      badge: '⭐ Best Match',
      why: `Covers your ${need} monthly ${categoryName.toLowerCase()} visit${need === 1 ? '' : 's'}.`,
      categoryName,
      need,
    }));
    if (covering[1]) {
      recommendations.push(buildCard(covering[1], {
        badge: 'More visits',
        why: `Adds extra ${categoryName.toLowerCase()} visits each month if you want more frequent care.`,
        categoryName,
        need,
      }));
    }
  } else {
    const largest = candidates[candidates.length - 1];
    recommendations.push(buildCard(largest, {
      badge: '⭐ Closest Match',
      why: `Our largest ${categoryName} plan covers ${unitsFor(largest, categoryName)} of your ${need} monthly visits — for full coverage, make a Special Ask.`,
      categoryName,
      need,
    }));
  }

  return { exceedsLimit: false, recommendations };
}

module.exports = {
  validateInputs,
  getSimplifiedRecommendation,
  loadActivePlans,
  formatPrice,
};
