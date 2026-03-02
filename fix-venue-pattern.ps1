# Script pour corriger le pattern venueId dans tous les fichiers de tests
$files = @(
    "__tests__\e2e\03-live-scoring.test.ts",
    "__tests__\e2e\11-admin.test.ts",
    "__tests__\e2e\13-api-types.test.ts",
    "__tests__\e2e\14-performance-edge-cases.test.ts",
    "__tests__\e2e\15-integration-flows.test.ts"
)

foreach ($file in $files) {
    Write-Host "Processing $file..."
    $content = Get-Content $file -Raw
    
    # Pattern 1: const venueId = await createTestVenue();
    #            createdIds.venues.push(venueId);
    # Remplacer par: const venue = await createTestVenue();
    #                createdIds.venues.push(venue.id);
    $content = $content -replace '(\s+)const venueId = await createTestVenue\(\);(\r?\n\s+)createdIds\.venues\.push\(venueId\);', '$1const venue = await createTestVenue();$2createdIds.venues.push(venue.id);'
    
    # Pattern 2: createTestMatch(user.id, venueId, ...
    # Remplacer par: createTestMatch(user.id, venue.id, ...
    $content = $content -replace 'createTestMatch\(([^,]+), venueId,', 'createTestMatch($1, venue.id,'
    
    # Pattern 3: createTestMatch(user.id, venueId)
    $content = $content -replace 'createTestMatch\(([^,]+), venueId\)', 'createTestMatch($1, venue.id)'
    
    Set-Content $file $content -NoNewline
    Write-Host "✓ $file corrigé"
}

Write-Host "`n✅ Tous les fichiers ont été corrigés!"
