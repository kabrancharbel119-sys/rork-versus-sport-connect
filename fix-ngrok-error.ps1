# Quick Fix Script for ERR_NGROK_3200
# This script helps resolve ngrok tunnel offline errors

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔧 Fixing ERR_NGROK_3200 Error" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if environment variable is set
$currentUrl = $env:EXPO_PUBLIC_RORK_API_BASE_URL

if ($currentUrl) {
    Write-Host "Current EXPO_PUBLIC_RORK_API_BASE_URL: $currentUrl" -ForegroundColor Yellow
    
    if ($currentUrl -match "\.exp\.direct|ngrok") {
        Write-Host "⚠️  Detected ngrok tunnel URL that may be offline" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Options:" -ForegroundColor Cyan
        Write-Host "1. Restart dev server to get new tunnel URL" -ForegroundColor White
        Write-Host "2. Use production/staging URL instead" -ForegroundColor White
        Write-Host ""
        
        $choice = Read-Host "Use production URL? (Y/N)"
        if ($choice -eq "Y" -or $choice -eq "y") {
            $env:EXPO_PUBLIC_RORK_API_BASE_URL = "https://dev-sjxgixvkcfy7t6xtks0wp.rorktest.dev"
            Write-Host "✅ Set to production URL" -ForegroundColor Green
            Write-Host "New URL: $env:EXPO_PUBLIC_RORK_API_BASE_URL" -ForegroundColor Green
        } else {
            Write-Host "ℹ️  Restart your dev server with: bun run start" -ForegroundColor Cyan
        }
    }
} else {
    Write-Host "ℹ️  EXPO_PUBLIC_RORK_API_BASE_URL is not set" -ForegroundColor Yellow
    Write-Host "Setting to production URL..." -ForegroundColor Cyan
    $env:EXPO_PUBLIC_RORK_API_BASE_URL = "https://dev-sjxgixvkcfy7t6xtks0wp.rorktest.dev"
    Write-Host "✅ Set to: $env:EXPO_PUBLIC_RORK_API_BASE_URL" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart your development server" -ForegroundColor White
Write-Host "2. Clear app cache if needed" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan


