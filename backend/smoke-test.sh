#!/bin/bash
# Luxora API smoke test — full durability suite (demo accounts: @luxora.lk)
# Target is overridable, e.g. SMOKE_BASE=http://127.0.0.1:5010/api bash smoke-test.sh
B=${SMOKE_BASE:-http://localhost:5000/api}
pass=0; fail=0
RND=$RANDOM
check() {
  if echo "$3" | grep -q "$2"; then pass=$((pass+1)); echo "PASS: $1"
  else fail=$((fail+1)); echo "FAIL: $1 — got: $(echo $3 | head -c 200)"; fi
}
jget() { python -c "import sys,json;d=json.loads(sys.argv[1]);print(d.get(sys.argv[2],''))" "$1" "$2" 2>/dev/null; }

# Tokens
CTOK=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"email":"customer@luxora.lk","password":"luxora123"}' | python -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
PTOK=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"email":"provider@luxora.lk","password":"luxora123"}' | python -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
ATOK=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@luxora.lk","password":"luxora123"}' | python -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
[ -n "$CTOK" ] && [ -n "$PTOK" ] && [ -n "$ATOK" ] && { pass=$((pass+1)); echo "PASS: all three demo logins"; } || { fail=$((fail+1)); echo "FAIL: demo logins"; }

echo "=== Catalog ==="
check "services has category_id" '"category_id"' "$(curl -s $B/services)"
check "categories" 'Auto Care' "$(curl -s $B/categories)"
check "subscriptions parse" 'Luxora Tri-Combo' "$(curl -s $B/subscriptions)"
check "promotions snake_case" 'discount_percent' "$(curl -s $B/promotions)"

echo "=== Auth hardening ==="
REG=$(curl -s -X POST $B/auth/register -H 'Content-Type: application/json' -d "{\"name\":\"Smoke\",\"email\":\"smoke$RND@test.com\",\"password\":\"secret123\"}")
check "register customer" '"token"' "$REG"
ADMIN_ATTEMPT=$(curl -s -X POST $B/auth/register -H 'Content-Type: application/json' -d "{\"name\":\"Hacker\",\"email\":\"hacker$RND@test.com\",\"password\":\"secret123\",\"role\":\"admin\"}")
check "admin self-registration BLOCKED" '"CUSTOMER"' "$ADMIN_ATTEMPT"
BAD_EMAIL=$(curl -s -X POST $B/auth/register -H 'Content-Type: application/json' -d "{\"name\":\"X\",\"email\":\"bad$RND\",\"password\":\"secret123\"}")
check "invalid email rejected" 'valid email' "$BAD_EMAIL"
SHORT_PW=$(curl -s -X POST $B/auth/register -H 'Content-Type: application/json' -d "{\"name\":\"X\",\"email\":\"x$RND@t.com\",\"password\":\"123\"}")
check "short password rejected" 'at least 6' "$SHORT_PW"
check "GET /auth/me" 'customer@luxora.lk' "$(curl -s $B/auth/me -H "Authorization: Bearer $CTOK")"
check "no token 401" 'Access token required' "$(curl -s $B/bookings/my)"
check "malformed JSON 400" 'Invalid JSON body' "$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{bad json')"
check "unknown endpoint JSON 404" 'Endpoint not found' "$(curl -s $B/nope)"

echo "=== Subscribe (demo checkout — direct activation is 410 by design) ==="
check "direct subscribe is 410" 'Direct activation is disabled' "$(curl -s -X POST $B/subscriptions/subscribe -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d '{"plan_id":1}')"
ORD=$(curl -s -X POST $B/payments/demo/order -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d '{"plan_id":1}')
check "demo order created" '"payment_id"' "$ORD"
PAYID=$(jget "$ORD" payment_id)
check "demo payment completed" 'completed' "$(curl -s -X POST $B/payments/demo/$PAYID/complete -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d '{"outcome":"success"}')"
check "checkout requires auth" 'Access token required' "$(curl -s -X POST $B/payments/demo/order -H 'Content-Type: application/json' -d '{"plan_id":1}')"
check "bad plan 404" 'Active plan not found' "$(curl -s -X POST $B/payments/demo/order -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d '{"plan_id":999}')"

echo "=== Booking lifecycle ==="
TOMORROW=$(date -d "+1 day" +%Y-%m-%d 2>/dev/null || date -v+1d +%Y-%m-%d)
BK=$(curl -s -X POST $B/bookings -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d "{\"service_id\":1,\"booking_date\":\"$TOMORROW\",\"booking_time\":\"09:00\"}")
check "booking auto-assigned" '"status":"assigned"' "$BK"
PIN=$(jget "$BK" pin_code); CPIN=$(jget "$BK" completion_pin); BID=$(jget "$BK" booking_id)
echo "   booking id=$BID start_pin=$PIN completion_pin=$CPIN"
check "past date rejected" 'cannot be in the past' "$(curl -s -X POST $B/bookings -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d '{"service_id":1,"booking_date":"2020-01-01","booking_time":"09:00"}')"
check "bad time rejected" 'booking_time' "$(curl -s -X POST $B/bookings -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d "{\"service_id\":1,\"booking_date\":\"$TOMORROW\",\"booking_time\":\"25:99\"}")"
check "bad service id rejected" 'service_id' "$(curl -s -X POST $B/bookings -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d "{\"service_id\":\"abc\",\"booking_date\":\"$TOMORROW\",\"booking_time\":\"09:00\"}")"
check "missing service 404" 'Service not found' "$(curl -s -X POST $B/bookings -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d "{\"service_id\":999,\"booking_date\":\"$TOMORROW\",\"booking_time\":\"09:00\"}")"
MY=$(curl -s $B/bookings/my -H "Authorization: Bearer $CTOK")
check "my bookings lowercase" '"status":"assigned"' "$MY"
if echo "$MY" | grep -q '"pinCode":"'; then fail=$((fail+1)); echo "FAIL: PIN leaked"; else pass=$((pass+1)); echo "PASS: PIN hidden"; fi

echo "=== Provider PIN flow (photo-gated lifecycle) ==="
printf '\x89PNG\r\n\x1a\nLUXORA-PNG-BYTES' > luxora-smoke.png
printf '#!/bin/sh\nrm -rf /' > luxora-smoke.txt
check "spoofed photo rejected (text bytes, .png name)" 'genuine JPEG or PNG' "$(curl -s -X POST $B/bookings/$BID/photos -H "Authorization: Bearer $PTOK" -F 'kind=BEFORE' -F 'photos=@luxora-smoke.txt;type=image/png')"
check "before photo uploaded" '"photos"' "$(curl -s -X POST $B/bookings/$BID/photos -H "Authorization: Bearer $PTOK" -F 'kind=BEFORE' -F 'photos=@luxora-smoke.png;type=image/png')"
check "wrong PIN rejected" 'Invalid PIN' "$(curl -s -X PUT $B/bookings/$BID/status -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d '{"status":"in_progress","pin_code":"0000"}')"
check "correct PIN starts" 'in_progress' "$(curl -s -X PUT $B/bookings/$BID/status -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d "{\"status\":\"in_progress\",\"pin_code\":\"$PIN\"}")"
check "after photo uploaded" '"photos"' "$(curl -s -X POST $B/bookings/$BID/photos -H "Authorization: Bearer $PTOK" -F 'kind=AFTER' -F 'photos=@luxora-smoke.png;type=image/png')"
check "correct PIN completes" 'completed' "$(curl -s -X PUT $B/bookings/$BID/status -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d "{\"status\":\"completed\",\"pin_code\":\"$CPIN\"}")"

echo "--- PIN lockout ---"
LK_BK=$(curl -s -X POST $B/bookings -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d "{\"service_id\":1,\"booking_date\":\"$TOMORROW\",\"booking_time\":\"14:00\"}")
LK_ID=$(jget "$LK_BK" booking_id)
LK_PIN=$(jget "$LK_BK" pin_code)
check "provider claims pending booking" 'assigned' "$(curl -s -X PUT $B/bookings/$LK_ID/status -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d '{"status":"assigned"}')"
curl -s -X POST $B/bookings/$LK_ID/photos -H "Authorization: Bearer $PTOK" -F 'kind=BEFORE' -F 'photos=@luxora-smoke.png;type=image/png' > /dev/null
for i in 1 2 3 4 5; do curl -s -X PUT $B/bookings/$LK_ID/status -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d '{"status":"in_progress","pin_code":"0000"}' > /dev/null; done
check "5 wrong PINs → lockout" 'locked' "$(curl -s -X PUT $B/bookings/$LK_ID/status -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d '{"status":"in_progress","pin_code":"0000"}')"
check "correct PIN also blocked while locked" 'locked' "$(curl -s -X PUT $B/bookings/$LK_ID/status -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d "{\"status\":\"in_progress\",\"pin_code\":\"$LK_PIN\"}")"
PIN_LEAK=$(curl -s $B/bookings/my -H "Authorization: Bearer $CTOK" | grep -c '"pinAttempts"\|"pinLockedUntil"\|"pinCode"' || true)
if [ "$PIN_LEAK" -eq 0 ]; then pass=$((pass+1)); echo "PASS: all PIN/security fields hidden"; else fail=$((fail+1)); echo "FAIL: pin fields leaked ($PIN_LEAK matches)"; fi
check "re-complete blocked (double payout)" 'Cannot move' "$(curl -s -X PUT $B/bookings/$BID/status -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d "{\"status\":\"completed\",\"pin_code\":\"$CPIN\"}" ; curl -s -X PUT $B/bookings/$BID/status -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d "{\"status\":\"completed\",\"pin_code\":\"$CPIN\"}")"
check "missing booking 404" 'Booking not found' "$(curl -s -X PUT $B/bookings/99999/status -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d '{"status":"completed","pin_code":"1234"}')"
EARN=$(curl -s $B/provider/earnings -H "Authorization: Bearer $PTOK")
if echo "$EARN" | grep -q '"earnings":'; then pass=$((pass+1)); echo "PASS: earnings endpoint (accumulates across runs)"; else fail=$((fail+1)); echo "FAIL: earnings — $EARN"; fi

echo "=== Reviews ==="
check "rating 9 rejected" '1 to 5' "$(curl -s -X POST $B/reviews -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d "{\"booking_id\":$BID,\"rating\":9}")"
check "review submitted" 'successfully' "$(curl -s -X POST $B/reviews -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d "{\"booking_id\":$BID,\"rating\":5,\"comment\":\"Spotless!\"}")"
check "duplicate rejected" 'already' "$(curl -s -X POST $B/reviews -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d "{\"booking_id\":$BID,\"rating\":4}")"
check "review others' booking rejected" 'not eligible' "$(curl -s -X POST $B/reviews -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d "{\"booking_id\":$BID,\"rating\":3}")"

echo "=== Complaints ==="
CMP=$(curl -s -X POST $B/complaints -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d '{"subject":"Late","description":"30 min late."}')
check "complaint created" 'registered' "$CMP"
CID=$(python -c "import sys,json;d=json.loads(sys.argv[1]);print(d.get('id') or d.get('complaint',{}).get('id',''))" "$CMP")
check "empty subject rejected" 'required' "$(curl -s -X POST $B/complaints -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d '{"subject":"","description":"x"}')"
check "others' booking rejected" 'not found among your bookings' "$(curl -s -X POST $B/complaints -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d "{\"booking_id\":$BID,\"subject\":\"S\",\"description\":\"D\"}")"

echo "=== Customer dashboard ==="
DASH=$(curl -s $B/customer/dashboard -H "Authorization: Bearer $CTOK")
check "dashboard reviews" 'Spotless' "$DASH"
check "dashboard shape" 'upcomingBookings' "$DASH"

echo "=== Admin ==="
STATS=$(curl -s $B/admin/stats -H "Authorization: Bearer $ATOK")
check "stats fields" 'openComplaints' "$STATS"
PROVLIST=$(curl -s $B/admin/providers -H "Authorization: Bearer $ATOK")
check "providers flattened" '"kyc_status"' "$PROVLIST"
check "admin bookings lowercase" '"status":"completed"' "$(curl -s $B/admin/bookings -H "Authorization: Bearer $ATOK")"
check "admin blocks provider" 'insufficient permissions' "$(curl -s $B/admin/stats -H "Authorization: Bearer $PTOK")"
check "admin blocks customer" 'insufficient permissions' "$(curl -s $B/admin/stats -H "Authorization: Bearer $CTOK")"
check "admin complaint lowercase update" 'in_review' "$(curl -s -X PUT $B/admin/complaints/$CID -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"status":"in_review"}')"
check "admin booking invalid status rejected" 'Invalid status' "$(curl -s -X PUT $B/admin/bookings/$BID -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"status":"nonsense"}')"
check "KYC invalid status rejected" 'must be one of' "$(curl -s -X PUT $B/admin/providers/1/kyc -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"status":"maybe"}')"

echo "=== Promotions ==="
NEWP=$(curl -s -X POST $B/promotions -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d "{\"title\":\"Deal $RND\",\"code\":\"D$RND\",\"discount_pct\":10}")
check "create promotion" 'created' "$NEWP"
check "discount 150 rejected" 'between 0 and 100' "$(curl -s -X POST $B/promotions -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"title":"Bad","discount_pct":150}')"
PID=$(curl -s $B/promotions | python -c "
import sys,json
ps=[p for p in json.load(sys.stdin) if p.get('code')=='D$RND']
print(ps[0]['id'] if ps else '')")
check "deactivate via active:0" 'deactivated' "$(curl -s -X PUT $B/promotions/$PID -H "Authorization: Bearer $ATOK" -H 'Content-Type: application/json' -d '{"active":0}')"
check "promo create blocked for customer" 'insufficient permissions' "$(curl -s -X POST $B/promotions -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d '{"title":"X"}')"

echo "=== Notifications ==="
NT=$(curl -s $B/notifications -H "Authorization: Bearer $PTOK")
check "provider notified" 'New booking assigned' "$NT"
check "mark all read" 'All notifications' "$(curl -s -X PUT $B/notifications/read-all -H "Authorization: Bearer $PTOK")"
check "mark read 404" 'not found' "$(curl -s -X PUT $B/notifications/999999/read -H "Authorization: Bearer $CTOK")"

echo "=== Cancel flow ==="
# The earlier bookings consumed the plan's Auto units — buy a fresh package first.
ORD2=$(curl -s -X POST $B/payments/demo/order -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d '{"plan_id":1}')
curl -s -X POST $B/payments/demo/$(jget "$ORD2" payment_id)/complete -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d '{"outcome":"success"}' > /dev/null
BK2=$(curl -s -X POST $B/bookings -H "Authorization: Bearer $CTOK" -H 'Content-Type: application/json' -d "{\"service_id\":2,\"booking_date\":\"$TOMORROW\",\"booking_time\":\"10:00\"}")
BID2=$(jget "$BK2" pin_code >/dev/null; jget "$BK2" booking_id)
check "cancel works" 'cancelled' "$(curl -s -X PUT $B/bookings/$BID2/cancel -H "Authorization: Bearer $CTOK")"
check "cancel twice rejected" 'Only pending or assigned' "$(curl -s -X PUT $B/bookings/$BID2/cancel -H "Authorization: Bearer $CTOK")"
check "cancellation notified" 'has been cancelled' "$(curl -s $B/notifications -H "Authorization: Bearer $CTOK")"
rm -f luxora-smoke.png luxora-smoke.txt

echo "=== Edge / abuse ==="
check "negative id handled" 'error' "$(curl -s -X PUT $B/bookings/-1/status -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d '{"status":"completed","pin_code":"1"}')"
check "oversized body rejected" 'request entity too large\|Payload too large\|error' "$(python -c "print('{\"x\":\"' + 'A'*300000 + '\"}')" | curl -s -X POST $B/auth/register -H 'Content-Type: application/json' -d @-)"
check "SQL-ish input safe" 'error\|required' "$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"' OR 1=1 --\",\"password\":\"x\"}")"
check "health endpoint" '"db":"up"' "$(curl -s $B/health)"

echo ""
echo "======================================"
echo "RESULTS: $pass passed, $fail failed"
echo "======================================"
