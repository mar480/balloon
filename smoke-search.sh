#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5000}"
YEAR="${YEAR:-2026}"
HREF="${HREF:-core-full-2026-01-01.xsd}"
Q="${Q:-turnover}"

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

need_cmd curl
need_cmd jq

echo "Using:"
echo "  BASE_URL=$BASE_URL"
echo "  YEAR=$YEAR"
echo "  HREF=$HREF"
echo "  Q=$Q"
echo

# 1) Happy path
resp1="$(curl -sS -X POST "$BASE_URL/api/search-concepts" \
  -H 'Content-Type: application/json' \
  -d "{\"year\":\"$YEAR\",\"href\":\"$HREF\",\"q\":\"$Q\",\"limit\":25,\"offset\":0}")"

echo "$resp1" | jq . >/dev/null || fail "Happy-path response is not valid JSON"
echo "$resp1" | jq -e '.results and .total != null and .limit == 25 and .offset == 0' >/dev/null \
  || fail "Happy-path response missing expected keys"
pass "happy path returns paginated JSON"

# 2) Missing year/href validation
resp2="$(curl -sS -X POST "$BASE_URL/api/search-concepts" \
  -H 'Content-Type: application/json' \
  -d '{"q":"turnover"}')"

echo "$resp2" | jq -e '.error == "Missing year or href"' >/dev/null \
  || fail "missing context validation message mismatch"
pass "missing year/href validation"

# 3) limit > 100 validation
resp3="$(curl -sS -X POST "$BASE_URL/api/search-concepts" \
  -H 'Content-Type: application/json' \
  -d "{\"year\":\"$YEAR\",\"href\":\"$HREF\",\"q\":\"$Q\",\"limit\":101,\"offset\":0}")"

echo "$resp3" | jq -e '.error == "limit must be between 1 and 100"' >/dev/null \
  || fail "limit validation message mismatch"
pass "limit upper-bound validation"

# 4) offset < 0 validation
resp4="$(curl -sS -X POST "$BASE_URL/api/search-concepts" \
  -H 'Content-Type: application/json' \
  -d "{\"year\":\"$YEAR\",\"href\":\"$HREF\",\"q\":\"$Q\",\"limit\":25,\"offset\":-1}")"

echo "$resp4" | jq -e '.error == "offset must be >= 0"' >/dev/null \
  || fail "offset validation message mismatch"
pass "offset lower-bound validation"

# 5) Deterministic ordering check (same request twice)
resp5a="$(curl -sS -X POST "$BASE_URL/api/search-concepts" \
  -H 'Content-Type: application/json' \
  -d "{\"year\":\"$YEAR\",\"href\":\"$HREF\",\"q\":\"$Q\",\"limit\":25,\"offset\":0}")"

resp5b="$(curl -sS -X POST "$BASE_URL/api/search-concepts" \
  -H 'Content-Type: application/json' \
  -d "{\"year\":\"$YEAR\",\"href\":\"$HREF\",\"q\":\"$Q\",\"limit\":25,\"offset\":0}")"

order_a="$(echo "$resp5a" | jq -c '[.results[].qname]')"
order_b="$(echo "$resp5b" | jq -c '[.results[].qname]')"

[[ "$order_a" == "$order_b" ]] || fail "result ordering is not stable across identical calls"
pass "deterministic order across repeated identical calls"

# 6) Pagination shift check
resp6a="$(curl -sS -X POST "$BASE_URL/api/search-concepts" \
  -H 'Content-Type: application/json' \
  -d "{\"year\":\"$YEAR\",\"href\":\"$HREF\",\"q\":\"$Q\",\"limit\":10,\"offset\":0}")"

resp6b="$(curl -sS -X POST "$BASE_URL/api/search-concepts" \
  -H 'Content-Type: application/json' \
  -d "{\"year\":\"$YEAR\",\"href\":\"$HREF\",\"q\":\"$Q\",\"limit\":10,\"offset\":10}")"

first_page_first_qname="$(echo "$resp6a" | jq -r '.results[0].qname // empty')"
second_page_first_qname="$(echo "$resp6b" | jq -r '.results[0].qname // empty')"

if [[ -n "$first_page_first_qname" && -n "$second_page_first_qname" && "$first_page_first_qname" == "$second_page_first_qname" ]]; then
  fail "pagination appears not to shift (first qname repeated)"
fi
pass "pagination offset shifts result window"

echo
pass "All smoke checks passed"