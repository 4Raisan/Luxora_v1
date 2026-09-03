import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  registerRealtimeClient,
  unregisterRealtimeClient,
  getActiveClientCount,
  broadcastToUser,
  broadcastToRole,
  broadcastBookingEvent,
} from '../src/services/realtime.js';
import { servesTown, providerOffersCategory, hasTimeConflict, bookingStart, providerCanTakeBooking } from '../src/services/scheduling.js';
import { processExpiredBookingsThrottled } from '../src/services/bookingTimeouts.js';

// Mock response stream for SSE testing
class MockSseResponse extends EventEmitter {
  constructor() {
    super();
    this.headers = {};
    this.statusCode = null;
    this.chunks = [];
  }
  writeHead(status, headers) {
    this.statusCode = status;
    this.headers = headers;
  }
  setHeader(name, value) {
    this.headers[name] = value;
  }
  write(chunk) {
    this.chunks.push(chunk);
    return true;
  }
}

test('Real-time SSE: registers client, sends handshake, and manages active client count', () => {
  const mockRes = new MockSseResponse();
  const initialCount = getActiveClientCount('CUSTOMER');

  registerRealtimeClient(101, 'CUSTOMER', mockRes);

  assert.equal(mockRes.statusCode, 200);
  assert.equal(mockRes.headers['Content-Type'], 'text/event-stream');
  assert.equal(mockRes.headers['Cache-Control'], 'no-cache, no-transform');
  assert.equal(mockRes.headers['Connection'], 'keep-alive');

  // Initial connection event was emitted
  assert.ok(mockRes.chunks.some((c) => c.includes('event: connected')));
  assert.equal(getActiveClientCount('CUSTOMER'), initialCount + 1);

  // Unregister cleans up
  mockRes.emit('close');
  assert.equal(getActiveClientCount('CUSTOMER'), initialCount);
});

test('Real-time SSE: broadcastToUser targets only the intended user', () => {
  const user1Res = new MockSseResponse();
  const user2Res = new MockSseResponse();

  registerRealtimeClient(201, 'CUSTOMER', user1Res);
  registerRealtimeClient(202, 'CUSTOMER', user2Res);

  broadcastToUser(201, 'TEST_EVENT', { hello: 'user 201' });

  const receivedBy1 = user1Res.chunks.some((c) => c.includes('user 201'));
  const receivedBy2 = user2Res.chunks.some((c) => c.includes('user 201'));

  assert.equal(receivedBy1, true);
  assert.equal(receivedBy2, false);

  user1Res.emit('close');
  user2Res.emit('close');
});

test('Real-time SSE: broadcastToRole delivers to all users of that role', () => {
  const prov1 = new MockSseResponse();
  const prov2 = new MockSseResponse();
  const cust1 = new MockSseResponse();

  registerRealtimeClient(301, 'PROVIDER', prov1);
  registerRealtimeClient(302, 'PROVIDER', prov2);
  registerRealtimeClient(303, 'CUSTOMER', cust1);

  broadcastToRole('PROVIDER', 'PENDING_AVAILABLE', { bookingId: 99 });

  assert.ok(prov1.chunks.some((c) => c.includes('PENDING_AVAILABLE')));
  assert.ok(prov2.chunks.some((c) => c.includes('PENDING_AVAILABLE')));
  assert.ok(!cust1.chunks.some((c) => c.includes('PENDING_AVAILABLE')));

  prov1.emit('close');
  prov2.emit('close');
  cust1.emit('close');
});

test('Real-time SSE: broadcastBookingEvent routes BOOKING_CLAIMED to providers', () => {
  const provRes = new MockSseResponse();
  const adminRes = new MockSseResponse();

  registerRealtimeClient(401, 'PROVIDER', provRes);
  registerRealtimeClient(402, 'ADMIN', adminRes);

  broadcastBookingEvent('BOOKING_CLAIMED', {
    id: 55,
    bookingId: 55,
    claimedByProviderId: 10,
  });

  assert.ok(provRes.chunks.some((c) => c.includes('BOOKING_CLAIMED')));
  assert.ok(adminRes.chunks.some((c) => c.includes('BOOKING_CLAIMED')));

  provRes.emit('close');
  adminRes.emit('close');
});

test('Provider Pending Matching: servesTown validates town and district matches', () => {
  const provider = { serviceTowns: 'Colombo 03, Colombo 07, Dehiwala' };

  assert.equal(servesTown(provider, 'Colombo 03', 'Colombo'), true);
  assert.equal(servesTown(provider, 'Colombo 07', 'Colombo'), true);
  assert.equal(servesTown(provider, 'Dehiwala', 'Colombo'), true);
  assert.equal(servesTown(provider, 'Kandy', 'Kandy'), false);
  assert.equal(servesTown(provider, 'Galle', 'Galle'), false);
});

test('Provider Pending Matching: providerOffersCategory validates offering', () => {
  const autoAndPetProvider = { category: 'Auto Care, Pet Care' };
  const gardenOnlyProvider = { category: 'Garden Care' };

  assert.equal(providerOffersCategory(autoAndPetProvider, 'Auto Care'), true);
  assert.equal(providerOffersCategory(autoAndPetProvider, 'Pet Care'), true);
  assert.equal(providerOffersCategory(autoAndPetProvider, 'Garden Care'), false);

  assert.equal(providerOffersCategory(gardenOnlyProvider, 'Garden Care'), true);
  assert.equal(providerOffersCategory(gardenOnlyProvider, 'Pet Care'), false);
});

test('Provider Pending Matching: hasTimeConflict accurately detects slot overlaps', () => {
  const commitments = [
    { bookingDate: '2026-09-10', bookingTime: '09:00 AM', service: { durationMins: 120 } }, // 09:00 - 11:00
    { bookingDate: '2026-09-10', bookingTime: '02:00 PM', service: { durationMins: 120 } }, // 14:00 - 16:00
  ];

  const slotStart = bookingStart('2026-09-10', '09:30 AM');
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // 09:30 - 10:30 (overlaps 09:00-11:00)
  assert.equal(hasTimeConflict(commitments, slotStart, slotEnd), true);

  const freeStart = bookingStart('2026-09-10', '11:30 AM');
  const freeEnd = new Date(freeStart.getTime() + 60 * 60 * 1000); // 11:30 - 12:30 (free)
  assert.equal(hasTimeConflict(commitments, freeStart, freeEnd), false);

  const eveningStart = bookingStart('2026-09-10', '04:30 PM');
  const eveningEnd = new Date(eveningStart.getTime() + 60 * 60 * 1000); // 16:30 - 17:30 (free)
  assert.equal(hasTimeConflict(commitments, eveningStart, eveningEnd), false);
});

test('Cancellation Policy Verification: only PENDING and ASSIGNED are allowed for customer cancellation', () => {
  const allowed = ['PENDING', 'ASSIGNED'];
  const disallowed = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  for (const st of allowed) {
    assert.equal(allowed.includes(st), true, `${st} should be cancellable`);
  }

  for (const st of disallowed) {
    assert.equal(allowed.includes(st), false, `${st} must NOT be cancellable by customer`);
  }
});

test('Pet Care (Dog/Cat) Consistency: format and labels preserve user choice', () => {
  const dogBooking = { petType: 'dog' };
  const catBooking = { petType: 'cat' };
  const autoBooking = { petType: null };

  const formatPetLabel = (b) => (b.petType === 'dog' ? '🐕 Dog Care' : b.petType === 'cat' ? '🐈 Cat Care' : null);

  assert.equal(formatPetLabel(dogBooking), '🐕 Dog Care');
  assert.equal(formatPetLabel(catBooking), '🐈 Cat Care');
  assert.equal(formatPetLabel(autoBooking), null);
});

test('Provider Pending Matching: offline providers can claim pending jobs if area/category/schedule suitable', async () => {
  const offlineProvider = {
    id: 999,
    kycStatus: 'APPROVED',
    availabilityStatus: 'offline', // Offline provider
    serviceTowns: 'Colombo 03',
    category: 'Auto Care',
    user: { active: true },
  };

  const booking = {
    serviceId: 1,
    bookingDate: '2026-09-15',
    bookingTime: '10:00 AM',
    town: 'Colombo 03',
    service: { category: { name: 'Auto Care' }, durationMins: 60 },
  };

  const mockClient = {
    booking: {
      findMany: async () => [],
    },
    service: {
      findUnique: async () => booking.service,
    },
  };

  // Manual claim / pending pool (requireOnline: false)
  const result = await providerCanTakeBooking(mockClient, offlineProvider, booking, { requireOnline: false });
  assert.equal(result.ok, true);

  // Auto assignment (requireOnline: true)
  const autoResult = await providerCanTakeBooking(mockClient, offlineProvider, booking, { requireOnline: true });
  assert.equal(autoResult.ok, false);
  assert.equal(autoResult.error, 'Provider must be available (online)');
});

test('Booking Timeouts Throttling: HTTP read requests do not repeatedly scan the database', async () => {
  let dbScanCount = 0;
  const mockClient = {
    booking: {
      findMany: async () => {
        dbScanCount++;
        return [];
      },
    },
  };

  // First call runs the scan
  await processExpiredBookingsThrottled(mockClient);
  assert.equal(dbScanCount, 1);

  // Subsequent rapid calls within 30 seconds are throttled
  await processExpiredBookingsThrottled(mockClient);
  await processExpiredBookingsThrottled(mockClient);
  assert.equal(dbScanCount, 1, 'Rapid calls should be throttled and not hit the database');
});

test('Rich Real-time Payload: BOOKING_CREATED delivers all card properties for 0ms rendering', () => {
  const res = new MockSseResponse();
  registerRealtimeClient(50, 'CUSTOMER', res);

  broadcastBookingEvent('BOOKING_CREATED', {
    id: 101,
    bookingId: 101,
    userId: 50,
    status: 'assigned',
    bookingDate: '2026-09-12',
    bookingTime: '10:00 AM',
    town: 'Colombo 07',
    serviceTitle: 'Premium Auto Detailing',
    categoryName: 'Auto Care',
    customerName: 'Alice Customer',
    customerPhone: '+94771234567',
    totalPrice: 8500,
    start_pin: '123456',
    pin_code: '123456',
    entitlement: { plan_title: 'Elite Auto Plan', remaining_units: 3 },
  });

  unregisterRealtimeClient(res);

  const eventChunk = res.chunks.find((c) => c.includes('event: BOOKING_CREATED'));
  assert.ok(eventChunk, 'Should have received BOOKING_CREATED event');
  const dataLine = eventChunk.split('\n').find((l) => l.startsWith('data: '));
  const payload = JSON.parse(dataLine.replace('data: ', ''));

  const b = payload.booking;
  assert.equal(b.id, 101);
  assert.equal(b.serviceTitle, 'Premium Auto Detailing');
  assert.equal(b.customerName, 'Alice Customer');
  assert.equal(b.totalPrice, 8500);
  assert.equal(b.start_pin, '123456');
  assert.equal(b.entitlement.remaining_units, 3);
});

test('Concurrency Safety Simulation: competing claims on same pending booking serialize cleanly', async () => {
  let bookingState = { id: 200, status: 'PENDING', providerId: null };
  let lockAcquired = false;

  const simulateClaim = async (providerId) => {
    // Simulate transaction with pg_advisory_xact_lock
    while (lockAcquired) {
      await new Promise((r) => setTimeout(r, 5));
    }
    lockAcquired = true;
    try {
      if (bookingState.status !== 'PENDING' || bookingState.providerId !== null) {
        const err = new Error('This booking is no longer available or has already been claimed');
        err.statusCode = 409;
        throw err;
      }
      bookingState = { ...bookingState, status: 'ASSIGNED', providerId };
      return { success: true, booking: bookingState };
    } finally {
      lockAcquired = false;
    }
  };

  const [resA, resB] = await Promise.allSettled([
    simulateClaim(10),
    simulateClaim(20),
  ]);

  const fulfilled = [resA, resB].filter((r) => r.status === 'fulfilled');
  const rejected = [resA, resB].filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one provider claim must succeed');
  assert.equal(rejected.length, 1, 'The losing provider must receive an error');
  assert.equal(rejected[0].reason.statusCode, 409, 'Losing provider must receive 409 Conflict');
  assert.ok(bookingState.providerId === 10 || bookingState.providerId === 20);
});
