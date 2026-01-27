#!/bin/bash

# Quick Fix Script for ERR_NGROK_3200
# This script helps resolve ngrok tunnel offline errors

echo "========================================"
echo "🔧 Fixing ERR_NGROK_3200 Error"
echo "========================================"
echo ""

# Check if environment variable is set
CURRENT_URL="${EXPO_PUBLIC_RORK_API_BASE_URL:-}"

if [ -n "$CURRENT_URL" ]; then
    echo "Current EXPO_PUBLIC_RORK_API_BASE_URL: $CURRENT_URL"
    
    if [[ "$CURRENT_URL" =~ \.exp\.direct|ngrok ]]; then
        echo "⚠️  Detected ngrok tunnel URL that may be offline"
        echo ""
        echo "Options:"
        echo "1. Restart dev server to get new tunnel URL"
        echo "2. Use production/staging URL instead"
        echo ""
        
        read -p "Use production URL? (y/n): " choice
        if [ "$choice" = "y" ] || [ "$choice" = "Y" ]; then
            export EXPO_PUBLIC_RORK_API_BASE_URL="https://dev-sjxgixvkcfy7t6xtks0wp.rorktest.dev"
            echo "✅ Set to production URL"
            echo "New URL: $EXPO_PUBLIC_RORK_API_BASE_URL"
        else
            echo "ℹ️  Restart your dev server with: bun run start"
        fi
    fi
else
    echo "ℹ️  EXPO_PUBLIC_RORK_API_BASE_URL is not set"
    echo "Setting to production URL..."
    export EXPO_PUBLIC_RORK_API_BASE_URL="https://dev-sjxgixvkcfy7t6xtks0wp.rorktest.dev"
    echo "✅ Set to: $EXPO_PUBLIC_RORK_API_BASE_URL"
fi

echo ""
echo "========================================"
echo "Next steps:"
echo "1. Restart your development server"
echo "2. Clear app cache if needed"
echo "========================================"


