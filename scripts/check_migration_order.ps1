# Run from backend directory. Read-only diagnostic; never resets or modifies the database.
$files = Get-ChildItem .\prisma\migrations -Directory | Sort-Object Name
$files | Where-Object { $_.Name -match 'google|hiring' } | ForEach-Object {
  Write-Host "--- $($_.Name) ---"
  Select-String -Path (Join-Path $_.FullName 'migration.sql') -Pattern 'hiring_requests' -ErrorAction SilentlyContinue
}
Write-Host 'Migration status:'
npx prisma migrate status
Write-Host 'Inspect _prisma_migrations applied checksums using your database admin tool before changing any migration SQL.'
