# Cleanup Unnecessary Documentation Files
# Removes TASK_* and *_SUMMARY.md files while keeping essential docs

Write-Host "🧹 Cleaning up unnecessary documentation files..." -ForegroundColor Yellow
Write-Host ""

# Files to remove (task implementation and summary files)
$filesToRemove = @(
    # Root level task files
    "ERRORS_FIXED_SUMMARY.md",
    "TASK_*.md",
    "*_SUMMARY.md",
    "SECTION_*.md",
    
    # Service-specific task files
    "services/TASK_*.md",
    "services/**/TASK_*.md",
    "services/**/*_SUMMARY.md",
    "services/**/*_IMPLEMENTATION.md",
    
    # Infrastructure task files
    "infrastructure/**/TASK_*.md",
    "infrastructure/**/*_SUMMARY.md",
    "infrastructure/**/*_IMPLEMENTATION.md",
    
    # Mobile app task files
    "mobile/**/TASK_*.md",
    "mobile/**/*_SUMMARY.md",
    "mobile/**/*_IMPLEMENTATION.md",
    
    # ML models task files
    "ml-models/**/TASK_*.md",
    "ml-models/**/*_SUMMARY.md",
    "ml-models/**/*_IMPLEMENTATION.md",
    "ml-models/**/IMPLEMENTATION_COMPLETE.md",
    
    # Tests task files
    "tests/**/TASK_*.md"
)

# Count files before cleanup
$beforeCount = (Get-ChildItem -Recurse -File -Filter "*.md" | Measure-Object).Count

Write-Host "Files before cleanup: $beforeCount" -ForegroundColor Cyan
Write-Host ""

$removedCount = 0
$removedFiles = @()

foreach ($pattern in $filesToRemove) {
    $files = Get-ChildItem -Path . -Filter $pattern -Recurse -File -ErrorAction SilentlyContinue
    
    foreach ($file in $files) {
        try {
            $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "")
            Write-Host "Removing: $relativePath" -ForegroundColor Gray
            Remove-Item $file.FullName -Force
            $removedCount++
            $removedFiles += $relativePath
        } catch {
            Write-Host "  ⚠ Could not remove: $relativePath" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "✅ Cleanup complete!" -ForegroundColor Green
Write-Host "Removed $removedCount files" -ForegroundColor Green
Write-Host ""

# Count files after cleanup
$afterCount = (Get-ChildItem -Recurse -File -Filter "*.md" | Measure-Object).Count
Write-Host "Files after cleanup: $afterCount" -ForegroundColor Cyan
Write-Host "Space saved: $($beforeCount - $afterCount) files" -ForegroundColor Green
Write-Host ""

# Show what's kept
Write-Host "📚 Important documentation kept:" -ForegroundColor Yellow
Write-Host "  ✓ README.md files" -ForegroundColor Green
Write-Host "  ✓ API documentation (docs/api/)" -ForegroundColor Green
Write-Host "  ✓ User guides (docs/user-guides/)" -ForegroundColor Green
Write-Host "  ✓ Privacy policies" -ForegroundColor Green
Write-Host "  ✓ Deployment guides" -ForegroundColor Green
Write-Host "  ✓ Infrastructure guides" -ForegroundColor Green
Write-Host "  ✓ Training materials" -ForegroundColor Green
Write-Host ""

# Create summary file
$summaryContent = @"
# Documentation Cleanup Summary

## Cleanup Date
$(Get-Date -Format "yyyy-MM-DD HH:mm:ss")

## Files Removed
Total: $removedCount files

### Removed Files List
$($removedFiles | ForEach-Object { "- $_" } | Out-String)

## Files Kept
Total: $afterCount markdown files

### Important Documentation Retained:
- README.md (project root and subdirectories)
- API Documentation (docs/api/)
- User Guides (docs/user-guides/)
- Privacy Policies (docs/privacy-policy/)
- Deployment Guides (DEPLOYMENT_GUIDE.md, GITHUB_SETUP.md, etc.)
- Infrastructure Documentation (infrastructure/*/README.md)
- Service Documentation (services/*/README.md)
- ML Model Documentation (ml-models/*/README.md)
- Training Materials (infrastructure/production/training/)
- Runbooks (infrastructure/production/runbooks/)

## Rationale
Removed task implementation files (TASK_*.md) and summary files (*_SUMMARY.md) 
as they were temporary development tracking documents not needed for production 
deployment or end-user documentation.
"@

$summaryContent | Out-File -FilePath "CLEANUP_SUMMARY.md" -Encoding UTF8
Write-Host "📄 Created CLEANUP_SUMMARY.md with details" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ready to push to GitHub! 🚀" -ForegroundColor Green
