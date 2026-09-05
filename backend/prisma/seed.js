// Seed script: categories, services, subscription plans, and demo accounts.
// Demo accounts are local/test fixtures. Production seeds catalogue data only.
// Run with: node backend/prisma/seed.js  (after `prisma db push`)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';

const seedAccountPasswords = () => {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.SEED_DEMO_ACCOUNTS === 'true') {
      throw new Error('Production seeding cannot create demo accounts. Create real accounts through the application instead.');
    }
    return null;
  }

  const required = ['CUSTOMER_PASSWORD', 'PROVIDER_PASSWORD', 'ADMIN_PASSWORD'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Local/test demo seeding requires explicit environment values: ${missing.join(', ')}`);
  }
  return {
    customer: process.env.CUSTOMER_PASSWORD,
    provider: process.env.PROVIDER_PASSWORD,
    admin: process.env.ADMIN_PASSWORD,
  };
};

const DEMO_PASSWORDS = seedAccountPasswords();

async function main() {
  // Categories (upsert so a renamed/missing row never crashes the seed)
  const ensureCategory = (data) => prisma.category.upsert({ where: { name: data.name }, update: {}, create: data });
  await ensureCategory({ name: 'Auto Care', description: 'Luxury automotive detailing, wash, and interior vacuuming at your doorstep.', icon: 'Car' });
  await ensureCategory({ name: 'Garden Care', description: 'Professional lawn mowing, watering, fertilizing, and landscape maintenance.', icon: 'Trees' });
  await ensureCategory({ name: 'Pet Care', description: 'Deluxe pet grooming, walking, bathing, and aquarium maintenance.', icon: 'Dog' });

  const auto = await prisma.category.findUniqueOrThrow({ where: { name: 'Auto Care' } });
  const garden = await prisma.category.findUniqueOrThrow({ where: { name: 'Garden Care' } });
  const pet = await prisma.category.findUniqueOrThrow({ where: { name: 'Pet Care' } });

  const svcCount = await prisma.service.count();
  if (svcCount === 0) {
    await prisma.service.createMany({
      data: [
        { categoryId: auto.id, title: 'Wash + Vacuum', description: 'Premium exterior foam wash, wheel shine, and complete interior deep vacuuming.', price: 4500, providerEarning: 2500, durationMins: 60 },
        { categoryId: auto.id, title: 'Full Auto Polish & Detailing', description: 'Paint correction, exterior wax polish, and interior leather conditioning.', price: 12500, providerEarning: 4500, durationMins: 120 },
        { categoryId: garden.id, title: 'Lawn Mowing', description: 'Precision edge trimming and complete lawn mowing.', price: 3500, providerEarning: 3000, durationMins: 45 },
        { categoryId: garden.id, title: 'Plant Watering & Health Care', description: 'Deep soil hydration, pest inspection, and botanical health check.', price: 2500, providerEarning: 2500, durationMins: 30 },
        { categoryId: garden.id, title: 'Fertilizer Application', description: 'Organic nutrient enrichment and soil conditioning.', price: 4000, providerEarning: 3000, durationMins: 40 },
        { categoryId: garden.id, title: 'Landscape Maintenance', description: 'Hedge trimming, weed control, and garden bed redesign.', price: 8500, providerEarning: 4500, durationMins: 90 },
        { categoryId: pet.id, title: 'Pet Bathing & Grooming', description: 'Hypoallergenic spa bath, blow dry, nail trimming, and ear cleaning.', price: 5000, providerEarning: 3300, durationMins: 60 },
        { categoryId: pet.id, title: 'Pet Walking (45 min)', description: 'Guided exercise walk and playtime for dogs.', price: 2000, providerEarning: 1800, durationMins: 45 },
        { categoryId: pet.id, title: 'Fish Tank Cleaning & Water Quality Test', description: 'Aquarium filter wash, algae removal, and pH balancing.', price: 6000, providerEarning: 3800, durationMins: 60 },
      ],
    });
  }
  const earningsByService = {
    'Wash + Vacuum': 2500, 'Full Auto Polish & Detailing': 4500,
    'Lawn Mowing': 3000, 'Plant Watering & Health Care': 2500,
    'Fertilizer Application': 3000, 'Landscape Maintenance': 4500,
    'Pet Bathing & Grooming': 3300, 'Pet Walking (45 min)': 1800,
    'Fish Tank Cleaning & Water Quality Test': 3800,
  };
  await Promise.all(Object.entries(earningsByService).map(([title, providerEarning]) =>
    prisma.service.updateMany({ where: { title }, data: { providerEarning } })
  ));
  await prisma.$executeRaw`
    UPDATE "bookings" AS booking
    SET "providerEarning" = service."providerEarning"
    FROM "services" AS service
    WHERE booking."serviceId" = service.id AND booking."providerEarning" = 0
  `;

  // Update any existing Single Care - Auto Elite plan to Basic Package
  await prisma.subscriptionPlan.updateMany({
    where: { title: 'Single Care - Auto Elite' },
    data: {
      title: 'Basic Package',
      type: 'Auto Care',
      priceMonthly: 5000,
      description: '1 vehicle service per month with exterior wash, interior vacuum, basic tire shine, and window cleaning.',
      recommended: true,
      features: JSON.stringify([
        '1 token',
        '1 vehicle service / month',
        'Exterior wash',
        'Interior vacuum',
        'Basic tire shine',
        'Window cleaning',
      ]),
    },
  });

  const planCount = await prisma.subscriptionPlan.count();
  if (planCount === 0) {
    await prisma.subscriptionPlan.createMany({
      data: [
        {
          title: 'Basic Package',
          type: 'Auto Care',
          priceMonthly: 5000,
          description: '1 vehicle service per month with exterior wash, interior vacuum, basic tire shine, and window cleaning.',
          recommended: true,
          features: JSON.stringify([
            '1 token',
            '1 vehicle service / month',
            'Exterior wash',
            'Interior vacuum',
            'Basic tire shine',
            'Window cleaning',
          ]),
          displayOrder: 1,
        },
        { title: 'Single Care - Garden Oasis', type: 'Garden Care', priceMonthly: 15000, description: 'Weekly garden upkeep, lawn mowing, and soil nourishment.', displayOrder: 1, features: JSON.stringify(['4x Lawn Mowing & Plant Watering', 'Monthly organic fertilizer treatment', 'Landscape consultation']) },
        { title: 'Luxora Tri-Combo Luxury Suite', type: 'Combo Package', priceMonthly: 32000, description: 'Complete home concierge covering Auto, Garden, and Pet Care under one subscription.', displayOrder: 1, features: JSON.stringify(['2x Auto Wash + Vacuum', '4x Garden Care & Lawn Mowing', '2x Pet Spa Bathing or Aquarium Service', 'Zero cancellation fees', 'VIP concierge hotline support']) },
      ],
    });
  }
  await prisma.subscriptionPlan.updateMany({ where: { title: 'Basic Package' }, data: { recommended: true } });

  const existingBasicPlan = await prisma.subscriptionPlan.findFirst({ where: { title: 'Basic Package' } });
  if (existingBasicPlan) {
    const existingEnt = await prisma.subscriptionEntitlement.findFirst({ where: { planId: existingBasicPlan.id, categoryId: auto.id } });
    if (existingEnt) {
      await prisma.subscriptionEntitlement.update({ where: { id: existingEnt.id }, data: { units: 1 } });
    }
  }

  // Per-category service units each plan grants (mirrors the marketed features).
  // Without these rows a purchased plan has no bookable entitlements.
  if (await prisma.subscriptionEntitlement.count() === 0) {
    const byTitle = async (title) => prisma.subscriptionPlan.findFirstOrThrow({ where: { title } });
    const [basicPkg, gardenOasis, triCombo] = await Promise.all([
      byTitle('Basic Package'), byTitle('Single Care - Garden Oasis'), byTitle('Luxora Tri-Combo Luxury Suite'),
    ]);
    await prisma.subscriptionEntitlement.createMany({
      data: [
        { planId: basicPkg.id, categoryId: auto.id, units: 1 },
        { planId: gardenOasis.id, categoryId: garden.id, units: 4 },
        { planId: triCombo.id, categoryId: auto.id, units: 2 },
        { planId: triCombo.id, categoryId: garden.id, units: 4 },
        { planId: triCombo.id, categoryId: pet.id, units: 2 },
      ],
    });
  }

  // Demo accounts — every password is bcrypt-hashed (10 rounds) before storage
  const ensure = async (name, email, phone, role, nic, category, password, town = null, serviceTowns = '') => {
    const pwHash = bcrypt.hashSync(password, 10);
    const existing = await prisma.user.findUnique({ where: { email } });
    let user = existing;
    if (existing) {
      user = await prisma.user.update({ where: { email }, data: { passwordHash: pwHash, phone: phone || '', phoneVerified: role === 'PROVIDER', role, town } });
    } else {
      user = await prisma.user.create({ data: { name, email, passwordHash: pwHash, phone: phone || '', phoneVerified: role === 'PROVIDER', town, role } });
    }
    if (role === 'PROVIDER') {
      await prisma.provider.upsert({
        where: { userId: user.id },
        update: { serviceTowns, kycStatus: 'APPROVED' },
        create: { userId: user.id, nic: nic || '123456789V', category: category || 'Auto Care', serviceTowns, kycStatus: 'APPROVED' },
      });
    }
  };

  if (DEMO_PASSWORDS) {
    await ensure('Luxora Customer', 'customer@luxora.lk', '0771000001', 'CUSTOMER', null, null, DEMO_PASSWORDS.customer, 'Colombo');
    await ensure('Luxora Provider', 'provider@luxora.lk', '0771000002', 'PROVIDER', '123456789V', 'Auto Care', DEMO_PASSWORDS.provider, null, 'Colombo, Colombo 03');
    await ensure('Luxora Admin', 'admin@luxora.lk', '0771000003', 'ADMIN', null, null, DEMO_PASSWORDS.admin);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
