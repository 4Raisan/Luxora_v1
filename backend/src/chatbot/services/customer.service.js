const storage = require('./storage.service');
const catalog = require('../data/catalog.json');

// Mock customer state (in production this connects to database)
let customerProfile = {
  memberId: 'LX-M-8834',
  name: 'Kausika & Family',
  email: 'kausika@luxora.com',
  phone: '+94 77 912 3456',
  address: '18 Horton Place, Colombo 07',
  subscription: {
    planId: 'luxora_family',
    planName: 'Luxora Family Membership',
    tierBadge: '⭐ Active Member',
    priceLKR: 28000,
    renewDate: '2026-09-15',
    status: 'Active'
  },
  tokenBalance: {
    auto: 3,
    garden: 2,
    pet: 2,
    total: 7
  },
  bookings: [
    {
      id: 'BK-7492',
      service: 'Auto Care (Standard)',
      date: '2026-08-27',
      timeSlot: '10:00 AM - 12:00 PM',
      provider: 'Nimal Perera (Certified Auto Specialist)',
      status: 'Scheduled',
      tokensUsed: 1
    },
    {
      id: 'BK-7104',
      service: 'Garden Care (Standard)',
      date: '2026-08-14',
      timeSlot: '02:00 PM - 04:00 PM',
      provider: 'Sunil Silva (Master Landscaper)',
      status: 'Completed',
      tokensUsed: 1
    },
    {
      id: 'BK-6889',
      service: 'Pet Care (Spa Wash & Grooming)',
      date: '2026-08-02',
      timeSlot: '11:00 AM - 01:00 PM',
      provider: 'Kavindi Fernando (Certified Pet Groomer)',
      status: 'Completed',
      tokensUsed: 1
    }
  ]
};

module.exports = {
  getCustomerProfile: () => {
    // Combine profile with real-time custom requests and tickets from storage
    const allRequests = storage.getRequestedServices();
    const allTickets = storage.getSupportTickets();
    
    return {
      ...customerProfile,
      customRequests: allRequests,
      supportTickets: allTickets
    };
  },
  bookService: ({ serviceType, date, timeSlot }) => {
    let tokenKey = 'auto';
    if (serviceType.toLowerCase().includes('garden')) tokenKey = 'garden';
    else if (serviceType.toLowerCase().includes('pet')) tokenKey = 'pet';

    if (customerProfile.tokenBalance[tokenKey] <= 0) {
      return { success: false, error: `You have 0 ${tokenKey} tokens remaining in your current billing cycle.` };
    }

    customerProfile.tokenBalance[tokenKey] -= 1;
    customerProfile.tokenBalance.total -= 1;

    const newBookingId = 'BK-' + Math.floor(1000 + Math.random() * 9000);
    const newBooking = {
      id: newBookingId,
      service: serviceType,
      date: date || new Date().toISOString().split('T')[0],
      timeSlot: timeSlot || '09:00 AM - 11:00 AM',
      provider: 'Assigned Luxora Specialist',
      status: 'Confirmed',
      tokensUsed: 1
    };

    customerProfile.bookings.unshift(newBooking);
    return { success: true, booking: newBooking, remainingTokens: customerProfile.tokenBalance };
  }
};
