// Seed script: categories, services, subscription plans, and demo accounts.
// Demo passwords come from environment variables (backend/.env) — see .env.example.
// Run with: node backend/prisma/seed.js  (after `prisma db push`)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';

const CUSTOMER_PASSWORD = process.env.CUSTOMER_PASSWORD || 'customer123';
const PROVIDER_PASSWORD = process.env.PROVIDER_PASSWORD || 'provider123';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

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
        { categoryId: auto.id, title: 'Wash + Vacuum', description: 'Premium exterior foam wash, wheel shine, and complete interior deep vacuuming.', price: 4500, durationMins: 60 },
        { categoryId: auto.id, title: 'Full Auto Polish & Detailing', description: 'Paint correction, exterior wax polish, and interior leather conditioning.', price: 12500, durationMins: 120 },
        { categoryId: garden.id, title: 'Lawn Mowing', description: 'Precision edge trimming and complete lawn mowing.', price: 3500, durationMins: 45 },
        { categoryId: garden.id, title: 'Plant Watering & Health Care', description: 'Deep soil hydration, pest inspection, and botanical health check.', price: 2500, durationMins: 30 },
        { categoryId: garden.id, title: 'Fertilizer Application', description: 'Organic nutrient enrichment and soil conditioning.', price: 4000, durationMins: 40 },
        { categoryId: garden.id, title: 'Landscape Maintenance', description: 'Hedge trimming, weed control, and garden bed redesign.', price: 8500, durationMins: 90 },
        { categoryId: pet.id, title: 'Pet Bathing & Grooming', description: 'Hypoallergenic spa bath, blow dry, nail trimming, and ear cleaning.', price: 5000, durationMins: 60 },
        { categoryId: pet.id, title: 'Pet Walking (45 min)', description: 'Guided exercise walk and playtime for dogs.', price: 2000, durationMins: 45 },
        { categoryId: pet.id, title: 'Fish Tank Cleaning & Water Quality Test', description: 'Aquarium filter wash, algae removal, and pH balancing.', price: 6000, durationMins: 60 },
      ],
    });
  }

  const planCount = await prisma.subscriptionPlan.count();
  if (planCount === 0) {
    await prisma.subscriptionPlan.createMany({
      data: [
        { title: 'Single Care - Auto Elite', type: 'single', priceMonthly: 12000, description: 'Bi-weekly exterior wash + interior vacuum for 1 luxury vehicle.', features: JSON.stringify(['2x Wash + Vacuum per month', 'Dedicated KYC provider', 'Priority booking window', '10% off add-on detailing']) },
        { title: 'Single Care - Garden Oasis', type: 'single', priceMonthly: 15000, description: 'Weekly garden upkeep, lawn mowing, and soil nourishment.', features: JSON.stringify(['4x Lawn Mowing & Plant Watering', 'Monthly organic fertilizer treatment', 'Landscape consultation']) },
        { title: 'Luxora Tri-Combo Luxury Suite', type: 'combo', priceMonthly: 32000, description: 'Complete home concierge covering Auto, Garden, and Pet Care under one subscription.', features: JSON.stringify(['2x Auto Wash + Vacuum', '4x Garden Care & Lawn Mowing', '2x Pet Spa Bathing or Aquarium Service', 'Zero cancellation fees', 'VIP concierge hotline support']) },
      ],
    });
  }

  // Per-category service units each plan grants (mirrors the marketed features).
  // Without these rows a purchased plan has no bookable entitlements.
  if (await prisma.subscriptionEntitlement.count() === 0) {
    const byTitle = async (title) => prisma.subscriptionPlan.findUniqueOrThrow({ where: { title } });
    const [autoElite, gardenOasis, triCombo] = await Promise.all([
      byTitle('Single Care - Auto Elite'), byTitle('Single Care - Garden Oasis'), byTitle('Luxora Tri-Combo Luxury Suite'),
    ]);
    await prisma.subscriptionEntitlement.createMany({
      data: [
        { planId: autoElite.id, categoryId: auto.id, units: 2 },
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
    if (existing) {
      await prisma.user.update({ where: { email }, data: { passwordHash: pwHash, role, town, isSuperAdmin: email === 'admin@luxora.lk' } });
      return;
    }
    const user = await prisma.user.create({ data: { name, email, passwordHash: pwHash, phone: phone || '', town, role, isSuperAdmin: email === 'admin@luxora.lk' } });
    if (role === 'PROVIDER') {
      await prisma.provider.upsert({
        where: { userId: user.id },
        update: { serviceTowns },
        create: { userId: user.id, nic: nic || '123456789V', category: category || 'Auto Care', serviceTowns, kycStatus: 'APPROVED' },
      });
    }
  };

  await ensure('Luxora Customer', 'customer@luxora.lk', '0771000001', 'CUSTOMER', null, null, CUSTOMER_PASSWORD, 'Colombo');
  await ensure('Luxora Provider', 'provider@luxora.lk', '0771000002', 'PROVIDER', '123456789V', 'Auto Care', PROVIDER_PASSWORD, null, 'Colombo, Colombo 03');
  await ensure('Luxora Admin', 'admin@luxora.lk', '0771000003', 'ADMIN', null, null, ADMIN_PASSWORD);

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
