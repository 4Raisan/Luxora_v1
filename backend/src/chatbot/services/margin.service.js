const catalog = require('../data/catalog.json');

function calculatePackageMargins() {
  const categories = [
    { key: 'auto_care', title: 'Auto Care', icon: '🚗' },
    { key: 'garden_care', title: 'Garden Care', icon: '🌿' },
    { key: 'pet_care', title: 'Pet Care', icon: '🐾' }
  ];

  const packagesWithMargins = [];

  categories.forEach(cat => {
    const service = catalog.services[cat.key];
    const payoutPerToken = service.providerPayoutPerToken;

    ['basic', 'standard', 'premium'].forEach(tierKey => {
      const tier = service.tiers[tierKey];
      const tokens = tier.tokens;
      const customerPrice = tier.price;
      const providerPayout = tokens * payoutPerToken;
      const luxoraMargin = customerPrice - providerPayout;
      const marginPercent = ((luxoraMargin / customerPrice) * 100).toFixed(1);

      packagesWithMargins.push({
        id: `${cat.key}_${tierKey}`,
        categoryKey: cat.key,
        categoryName: service.name,
        categoryIcon: service.icon,
        tierKey: tierKey,
        tierName: tierKey.toUpperCase(),
        isBasic: tierKey === 'basic',
        packageName: tier.name,
        tokensIncluded: tokens,
        tagline: tier.tagline,
        suitableFor: tier.suitableFor || tier.capacity || tier.coverage || '',
        customerPrice: customerPrice,
        providerPayoutPerToken: payoutPerToken,
        providerTotalPayout: providerPayout,
        luxoraMargin: luxoraMargin,
        marginPercent: `${marginPercent}%`,
        currency: catalog.currency || 'LKR'
      });
    });
  });

  return packagesWithMargins;
}

module.exports = {
  calculatePackageMargins
};
