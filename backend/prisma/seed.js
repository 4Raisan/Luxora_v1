// Seed script: categories, services, subscription plans, and a universal demo
// account (one password for all three roles via +alias emails).
// Run with: node backend/prisma/seed.js  (after `prisma db push`)
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';

const UNIVERSAL_PW = '12345678';

async function main() {
  // Categories
  const catCount = await prisma.category.count();
  if (catCount === 0) {
    await prisma.category.createMany({
      data: [
        { name: 'Auto Care', description: 'Luxury automotive detailing, wash, and interior vacuuming at your doorstep.', icon: 'Car' },
        { name: 'Garden Care', description: 'Professional lawn mowing, watering, fertilizing, and landscape maintenance.', icon: 'Trees' },
        { name: 'Pet Care', description: 'Deluxe pet grooming, walking, bathing, and aquarium maintenance.', icon: 'Dog' },
      ],
    });
  }

  const auto = await prisma.category.findFirst({ where: { name: 'Auto Care' } });
  const garden = await prisma.category.findFirst({ where: { name: 'Garden Care' } });
  const pet = await prisma.category.findFirst({ where: { name: 'Pet Care' } });

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

  // Universal demo account (one password, three roles via +alias emails)
  const hash = bcrypt.hashSync(UNIVERSAL_PW, 10);
  const ensure = async (name, email, phone, role, nic, category) => {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.update({ where: { email }, data: { passwordHash: hash, role } });
      return;
    }
    const user = await prisma.user.create({ data: { name, email, passwordHash: hash, phone: phone || '', role } });
    if (role === 'PROVIDER') {
      await prisma.provider.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, nic: nic || '123456789V', category: category || 'Auto Care', kycStatus: 'APPROVED' },
      });
    }
  };

  await ensure('Tester Customer', 'tester@gmail.com', '0771000001', 'CUSTOMER', null, null);
  await ensure('Tester Provider', 'tester.provider@gmail.com', '0771000002', 'PROVIDER', '123456789V', 'Auto Care');
  await ensure('Tester Admin', 'tester.admin@gmail.com', '0771000003', 'ADMIN', null, null);

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
