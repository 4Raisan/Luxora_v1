// TZ-proof check for the Colombo-explicit scheduling helpers.
// Run with TZ=UTC (or any zone): all assertions use fixed instants and
// Colombo wall-clock strings, so they hold regardless of server timezone.
import assert from 'node:assert/strict';
import {
  bookingWallHour,
  colomboNow,
  isInAutoAssignmentWindow,
  meetsLeadTimeHours,
  providerCancellationPolicy,
} from '../../src/services/scheduling.js';

const settings = { autoAssignmentStartHour: 7, autoAssignmentEndHour: 16 };

// Window boundaries on wall-clock strings (TZ-independent by construction).
assert.equal(bookingWallHour('2026-09-10', '06:59'), 6);
assert.equal(bookingWallHour('2026-09-10', '07:00'), 7);
assert.equal(bookingWallHour('2026-09-10', '04:00 PM'), 16);
assert.equal(bookingWallHour('2026-09-10', '07:00 PM'), 19);
assert.equal(isInAutoAssignmentWindow('2026-09-10', '06:59', settings), false);
assert.equal(isInAutoAssignmentWindow('2026-09-10', '07:00', settings), true);
assert.equal(isInAutoAssignmentWindow('2026-09-10', '12:00', settings), true);
assert.equal(isInAutoAssignmentWindow('2026-09-10', '16:00', settings), true);
assert.equal(isInAutoAssignmentWindow('2026-09-10', '17:00', settings), false);

// Lead time: slot 14:00 Colombo wall. Instant 10:00+0530 == 04:30Z.
const slot = ['2026-09-10', '14:00'];
const exactly4h = new Date('2026-09-10T04:30:00.000Z');
const minus1s = new Date('2026-09-10T04:30:01.000Z');
const plus1h = new Date('2026-09-10T03:30:00.000Z');
assert.equal(meetsLeadTimeHours(slot[0], slot[1], 4, exactly4h), true, 'exactly 4h must pass');
assert.equal(meetsLeadTimeHours(slot[0], slot[1], 4, minus1s), false, '4h minus 1s must fail');
assert.equal(meetsLeadTimeHours(slot[0], slot[1], 4, plus1h), true);

// Provider cancellation uses the same Colombo frame: exactly 4h allowed.
assert.equal(providerCancellationPolicy(slot[0], slot[1], exactly4h).canCancel, true);
assert.equal(providerCancellationPolicy(slot[0], slot[1], minus1s).canCancel, false);

// colomboNow sanity: 04:30Z wall-renders as 10:00 Colombo in any server zone.
const wall = colomboNow(exactly4h);
const wallH = wall.getHours();
const wallM = wall.getMinutes();
assert.ok(wallH === 10 && wallM === 0, `expected 10:00 frame, got ${wallH}:${wallM} (server TZ=${Intl.DateTimeFormat().resolvedOptions().timeZone})`);

console.log(`TZ-CHECK-PASS tz=${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
