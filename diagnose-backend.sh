#!/bin/bash

echo "========================================"
echo "🔍 VS BACKEND DIAGNOSTIC SCRIPT"
echo "========================================"
echo ""

# Configuration
API_URL="${EXPO_PUBLIC_RORK_API_BASE_URL:-https://dev-sjxgixvkcfy7t6xtks0wp.rorktest.dev}"
echo "📡 API URL: $API_URL"
echo ""

# Test 1: Basic connectivity
echo "========================================"
echo "TEST 1: Basic Connectivity"
echo "========================================"
echo "Testing: $API_URL/api"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}s" "$API_URL/api" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
TIME=$(echo "$RESPONSE" | grep "TIME:" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:" | grep -v "TIME:")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Status: $HTTP_CODE (OK)"
else
    echo "❌ Status: $HTTP_CODE (FAILED)"
fi
echo "⏱️  Time: $TIME"
echo "📦 Response: $BODY"
echo ""

# Test 2: Health endpoint
echo "========================================"
echo "TEST 2: Health Endpoint"
echo "========================================"
echo "Testing: $API_URL/api/health"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$API_URL/api/health" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Status: $HTTP_CODE (OK)"
else
    echo "❌ Status: $HTTP_CODE (FAILED)"
fi
echo "📦 Response: $BODY"
echo ""

# Test 3: tRPC endpoint
echo "========================================"
echo "TEST 3: tRPC Endpoint"
echo "========================================"
echo "Testing: $API_URL/api/trpc"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$API_URL/api/trpc" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")

echo "📦 Status: $HTTP_CODE"
echo "📦 Response: $BODY"
echo ""

# Test 4: tRPC health query
echo "========================================"
echo "TEST 4: tRPC Health Query"
echo "========================================"
echo "Testing: $API_URL/api/trpc/health"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -H "Content-Type: application/json" \
    "$API_URL/api/trpc/health" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")

echo "📦 Status: $HTTP_CODE"
echo "📦 Response: $BODY"
echo ""

# Test 5: DNS resolution
echo "========================================"
echo "TEST 5: DNS Resolution"
echo "========================================"
DOMAIN=$(echo "$API_URL" | sed 's|https://||' | sed 's|/.*||')
echo "Resolving: $DOMAIN"
nslookup "$DOMAIN" 2>&1 | head -10
echo ""

# Test 6: SSL Certificate
echo "========================================"
echo "TEST 6: SSL Certificate Check"
echo "========================================"
echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>&1
echo ""

# Test 7: Verbose curl with headers
echo "========================================"
echo "TEST 7: Full Response Headers"
echo "========================================"
curl -sI "$API_URL/api" 2>&1 | head -20
echo ""

# Test 8: Check for CORS
echo "========================================"
echo "TEST 8: CORS Headers Check"
echo "========================================"
curl -s -I -X OPTIONS \
    -H "Origin: http://localhost:8081" \
    -H "Access-Control-Request-Method: POST" \
    "$API_URL/api/trpc" 2>&1 | grep -i "access-control"
echo ""

# Summary
echo "========================================"
echo "📊 DIAGNOSTIC SUMMARY"
echo "========================================"
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Backend appears to be RUNNING"
    echo ""
    echo "If you still see 'Failed to fetch' errors:"
    echo "1. Check browser console for CORS errors"
    echo "2. Check network tab for actual request URL"
    echo "3. Ensure the app is using correct API URL"
else
    echo "❌ Backend is NOT RESPONDING"
    echo ""
    echo "Possible causes:"
    echo "1. Backend not deployed - run: touch backend/hono.ts"
    echo "2. Deployment in progress - wait 1-2 minutes"
    echo "3. Code error preventing startup - check backend logs"
    echo "4. Missing environment variables"
fi
echo ""
echo "========================================"
echo "🏁 Diagnostic complete"
echo "========================================"
