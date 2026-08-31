const catalog = require('../data/catalog.json');

function validateInputs({ cars = 0, perches = 0, pets = 0 }) {
  const errors = [];

  // Check cars
  if (cars !== undefined && cars !== null) {
    if (isNaN(cars)) errors.push('Please enter a valid number of vehicles.');
    else if (cars < 0) errors.push('Number of vehicles cannot be negative.');
    else if (!Number.isInteger(Number(cars))) errors.push('Number of vehicles must be a whole number.');
  }

  // Check pets
  if (pets !== undefined && pets !== null) {
    if (isNaN(pets)) errors.push('Please enter a valid number of pets.');
    else if (pets < 0) errors.push('Number of pets cannot be negative.');
    else if (!Number.isInteger(Number(pets))) errors.push('Number of pets must be a whole number.');
  }

  // Check perches
  if (perches !== undefined && perches !== null) {
    if (isNaN(perches)) errors.push('Please enter a valid garden size in perches.');
    else if (perches < 0) errors.push('Garden size cannot be negative.');
  }

  return errors;
}

function getSimplifiedRecommendation({ cars = 0, perches = 0, pets = 0 }) {
  const validationErrors = validateInputs({ cars, perches, pets });
  if (validationErrors.length > 0) {
    return {
      invalid: true,
      error: validationErrors.join(' '),
      recommendations: []
    };
  }

  const numCars = Math.max(0, parseInt(cars, 10) || 0);
  const numPets = Math.max(0, parseInt(pets, 10) || 0);
  const numPerches = Math.max(0, parseFloat(perches) || 0);

  // 1. Check Maximum Limits
  // Auto Care: Maximum 6 vehicles (7+ -> Outside standard coverage)
  if (numCars > 6) {
    return {
      exceedsLimit: true,
      categoryKey: 'AUTO_CARE',
      categoryName: 'Auto Care',
      enteredQuantity: `${numCars} vehicles`,
      noticeTitle: 'Need something beyond our standard coverage?',
      noticeText: "Your requirement exceeds the standard service range (up to 6 vehicles). If you'd like Luxora to handle this, you can submit a Special Ask and our team will review your requirements individually.",
      specialAskOption: {
        title: 'Special Ask Service',
        description: "Have a requirement that doesn't fit our standard packages? Submit a special request and our Luxora team will review your requirements and get back to you with the appropriate solution.",
        buttonLabel: 'Request Special Service'
      },
      recommendations: []
    };
  }

  // Pet Care: Maximum 5 pets (6+ -> Outside standard coverage)
  if (numPets > 5) {
    return {
      exceedsLimit: true,
      categoryKey: 'PET_CARE',
      categoryName: 'Pet Care',
      enteredQuantity: `${numPets} pets`,
      noticeTitle: 'Need something beyond our standard coverage?',
      noticeText: "Your requirement exceeds the standard service range (up to 5 pets). If you'd like Luxora to handle this, you can submit a Special Ask and our team will review your requirements individually.",
      specialAskOption: {
        title: 'Special Ask Service',
        description: "Have a requirement that doesn't fit our standard packages? Submit a special request and our Luxora team will review your requirements and get back to you with the appropriate solution.",
        buttonLabel: 'Request Special Service'
      },
      recommendations: []
    };
  }

  // Garden Care: Maximum 30 perches (31+ -> Outside standard coverage)
  if (numPerches > 30) {
    return {
      exceedsLimit: true,
      categoryKey: 'GARDEN_CARE',
      categoryName: 'Garden Care',
      enteredQuantity: `${numPerches} perches`,
      noticeTitle: 'Need something beyond our standard coverage?',
      noticeText: "Your property exceeds the standard service range (up to 30 perches). If you'd like Luxora to handle this, you can submit a Special Ask and our team will review your requirements individually.",
      specialAskOption: {
        title: 'Special Ask Service',
        description: "Have a requirement that doesn't fit our standard packages? Submit a special request and our Luxora team will review your requirements and get back to you with the appropriate solution.",
        buttonLabel: 'Request Special Service'
      },
      recommendations: []
    };
  }

  const recommendations = [];
  const defaultSpecialAsk = {
    title: 'Special Ask Service',
    description: "Have a requirement that doesn't fit our standard packages? Submit a special request and our Luxora team will review your requirements and get back to you with the appropriate solution.",
    buttonLabel: 'Make a Special Ask'
  };

  // 2. Check if Combo is best (multiple services within limits)
  const isMultiService = (numCars > 0 ? 1 : 0) + (numPerches > 0 ? 1 : 0) + (numPets > 0 ? 1 : 0) >= 2;

  if (isMultiService) {
    if (numCars <= 2 && numPerches > 0 && numPerches < 10 && numPets <= 1) {
      // Luxora Home
      recommendations.push({
        badge: '⭐ Best Match',
        name: 'Luxora Home',
        categoryKey: 'combo',
        price: 'LKR 18,000/month',
        features: ['2 Auto Care visits', '1 Garden Care visit', '1 Pet Care visit'],
        why: 'You have up to 2 cars, a small garden, and 1 pet.'
      });
      recommendations.push({
        badge: 'Another good option',
        name: 'Auto Care Standard + Garden Care Basic',
        categoryKey: 'combo',
        price: 'LKR 16,500/month',
        features: ['2 Auto Care visits', '1 Garden Care visit'],
        why: 'A slightly lower-cost choice if you want to care for your cars and garden first.'
      });
    } else if (numCars <= 4 && numPerches <= 20 && numPets <= 2) {
      // Luxora Family
      recommendations.push({
        badge: '⭐ Best Match',
        name: 'Luxora Family',
        categoryKey: 'combo',
        price: 'LKR 28,000/month',
        features: ['4 Auto Care visits', '2 Garden Care visits', '2 Pet Care visits'],
        why: 'You have 2–4 cars, a medium-sized garden (10–20 perches), and up to 2 pets.'
      });
      recommendations.push({
        badge: 'Lower-cost option',
        name: 'Luxora Home',
        categoryKey: 'combo',
        price: 'LKR 18,000/month',
        features: ['2 Auto Care visits', '1 Garden Care visit', '1 Pet Care visit'],
        why: 'A budget-friendly option with fewer monthly service visits.'
      });
    } else {
      // Luxora Prestige
      recommendations.push({
        badge: '⭐ Best Match',
        name: 'Luxora Prestige',
        categoryKey: 'combo',
        price: 'LKR 40,000/month',
        features: ['4 Auto Care visits', '4 Garden Care visits', '4 Pet Care visits'],
        why: 'You have a large garden (20–30 perches), multiple vehicles (up to 6), and up to 5 pets.'
      });
      recommendations.push({
        badge: 'Another good option',
        name: 'Luxora Family',
        categoryKey: 'combo',
        price: 'LKR 28,000/month',
        features: ['4 Auto Care visits', '2 Garden Care visits', '2 Pet Care visits'],
        why: 'Covers all services with moderate monthly visits at a lower price.'
      });
    }
    return { exceedsLimit: false, recommendations, specialAskOption: defaultSpecialAsk };
  }

  // 3. Single Service: Auto Care only (1 to 6 vehicles)
  if (numCars > 0 && numPerches === 0 && numPets === 0) {
    if (numCars === 1) {
      recommendations.push({
        badge: '⭐ Best Match',
        name: 'Auto Care Basic',
        categoryKey: 'auto',
        price: 'LKR 5,000/month',
        features: ['1 Full Car Wash & Interior Vacuum'],
        why: 'Ideal for maintaining 1 car once a month.'
      });
      recommendations.push({
        badge: 'More visits',
        name: 'Auto Care Standard',
        categoryKey: 'auto',
        price: 'LKR 9,000/month',
        features: ['2 Full Car Washes & Interior Vacuums'],
        why: 'Gives you 2 washes per month to keep your car cleaner.'
      });
    } else if (numCars === 2) {
      recommendations.push({
        badge: '⭐ Best Match',
        name: 'Auto Care Standard',
        categoryKey: 'auto',
        price: 'LKR 9,000/month',
        features: ['2 Car Washes (1 per car each month)'],
        why: 'Covers both of your cars each month.'
      });
      recommendations.push({
        badge: 'More frequent care',
        name: 'Auto Care Premium',
        categoryKey: 'auto',
        price: 'LKR 15,000/month',
        features: ['4 Car Washes & Detailing'],
        why: 'Gives you 2 washes for each car every month.'
      });
    } else {
      // 3 to 6 vehicles
      recommendations.push({
        badge: '⭐ Best Match',
        name: 'Auto Care Premium',
        categoryKey: 'auto',
        price: 'LKR 15,000/month',
        features: ['4 Car Washes, Vacuuming & Detailing'],
        why: `Covers your ${numCars} vehicles with weekly doorstep washes.`
      });
      recommendations.push({
        badge: 'Lower-cost option',
        name: 'Auto Care Standard',
        categoryKey: 'auto',
        price: 'LKR 9,000/month',
        features: ['2 Car Washes & Vacuums'],
        why: 'Covers 2 vehicle washes per month.'
      });
    }
    return { exceedsLimit: false, recommendations, specialAskOption: defaultSpecialAsk };
  }

  // 4. Single Service: Garden Care only (1 to 30 perches)
  if (numPerches > 0 && numCars === 0 && numPets === 0) {
    if (numPerches < 10) {
      recommendations.push({
        badge: '⭐ Best Match',
        name: 'Garden Care Basic',
        categoryKey: 'garden',
        price: 'LKR 7,500/month',
        features: ['1 Garden Visit (Lawn mowing, edging, weeding, fertilizer, pruning)'],
        why: 'Covers gardens under 10 perches.'
      });
      recommendations.push({
        badge: 'More visits',
        name: 'Garden Care Standard',
        categoryKey: 'garden',
        price: 'LKR 14,000/month',
        features: ['2 Garden Visits per month'],
        why: 'Keep your lawn manicured with visits every 2 weeks.'
      });
    } else if (numPerches <= 20) {
      recommendations.push({
        badge: '⭐ Best Match',
        name: 'Garden Care Standard',
        categoryKey: 'garden',
        price: 'LKR 14,000/month',
        features: ['2 Garden Visits (Lawn mowing, edging, weeding, fertilizer, pruning)'],
        why: 'Best for 10–20 perch gardens.'
      });
      recommendations.push({
        badge: 'Weekly care',
        name: 'Garden Care Premium',
        categoryKey: 'garden',
        price: 'LKR 24,000/month',
        features: ['4 Garden Visits per month'],
        why: 'Weekly care for your lawn and plants.'
      });
    } else {
      // 21 to 30 perches
      recommendations.push({
        badge: '⭐ Best Match',
        name: 'Garden Care Premium',
        categoryKey: 'garden',
        price: 'LKR 24,000/month',
        features: ['4 Garden Visits per month (Weekly lawn care)'],
        why: `Best for large ${numPerches}-perch gardens (within our 30-perch limit).`
      });
      recommendations.push({
        badge: 'Lower-cost option',
        name: 'Garden Care Standard',
        categoryKey: 'garden',
        price: 'LKR 14,000/month',
        features: ['2 Garden Visits per month'],
        why: 'Bi-weekly garden care for larger estates.'
      });
    }
    return { exceedsLimit: false, recommendations, specialAskOption: defaultSpecialAsk };
  }

  // 5. Single Service: Pet Care only (1 to 5 pets)
  if (numPets > 0 && numCars === 0 && numPerches === 0) {
    if (numPets === 1) {
      recommendations.push({
        badge: '⭐ Best Match',
        name: 'Pet Care Basic',
        categoryKey: 'pet',
        price: 'LKR 6,000/month',
        features: ['1 Full Grooming Session (Spa wash, dry, nails, ears, brushing, coat fluff)'],
        why: 'Perfect for 1 pet once a month.'
      });
      recommendations.push({
        badge: 'More grooming',
        name: 'Pet Care Standard',
        categoryKey: 'pet',
        price: 'LKR 11,000/month',
        features: ['2 Grooming Sessions per month'],
        why: 'Groom your pet twice a month.'
      });
    } else if (numPets === 2) {
      recommendations.push({
        badge: '⭐ Best Match',
        name: 'Pet Care Standard',
        categoryKey: 'pet',
        price: 'LKR 11,000/month',
        features: ['2 Grooming Sessions (1 per pet)'],
        why: 'Covers both of your pets each month.'
      });
      recommendations.push({
        badge: 'More frequent care',
        name: 'Pet Care Premium',
        categoryKey: 'pet',
        price: 'LKR 18,000/month',
        features: ['4 Grooming Sessions per month'],
        why: 'Covers 2 grooming sessions for each pet.'
      });
    } else {
      // 3 to 5 pets
      recommendations.push({
        badge: '⭐ Best Match',
        name: 'Pet Care Premium',
        categoryKey: 'pet',
        price: 'LKR 18,000/month',
        features: ['4 Grooming Sessions per month'],
        why: `Covers your ${numPets} pets comfortably (within our 5-pet limit).`
      });
      recommendations.push({
        badge: 'Lower-cost option',
        name: 'Pet Care Standard',
        categoryKey: 'pet',
        price: 'LKR 11,000/month',
        features: ['2 Grooming Sessions per month'],
        why: '2 grooming sessions shared across your pets.'
      });
    }
    return { exceedsLimit: false, recommendations, specialAskOption: defaultSpecialAsk };
  }

  // Default clean recommendation
  recommendations.push({
    badge: '⭐ Best Match',
    name: 'Luxora Family',
    categoryKey: 'combo',
    price: 'LKR 28,000/month',
    features: ['4 Auto Care', '2 Garden Care', '2 Pet Care'],
    why: 'Our most popular all-inclusive home care package.'
  });

  return { exceedsLimit: false, recommendations, specialAskOption: defaultSpecialAsk };
}

module.exports = {
  validateInputs,
  getSimplifiedRecommendation
};
