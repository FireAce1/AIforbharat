#!/bin/bash

# Cleanup Unnecessary Documentation Files
# Removes TASK_* and *_SUMMARY.md files while keeping essential docs

set -e

echo "🧹 Cleaning up unnecessary documentation files..."
echo ""

# Count files before cleanup
BEFORE_COUNT=$(find . -name "*.md" -type f | wc -l)
echo "Files before cleanup: $BEFORE_COUNT"
echo ""

REMOVED_COUNT=0

# Remove task implementation files
echo "Removing TASK_* files..."
find . -name "TASK_*.md" -type f -print -delete 2>/dev/null | while read file; do
    echo "  Removed: $file"
    ((REMOVED_COUNT++))
done

# Remove summary files
echo "Removing *_SUMMARY.md files..."
find . -name "*_SUMMARY.md" -type f -print -delete 2>/dev/null | while read file; do
    echo "  Removed: $file"
    ((REMOVED_COUNT++))
done

# Remove implementation files
echo "Removing *_IMPLEMENTATION.md files..."
find . -name "*_IMPLEMENTATION.md" -type f -print -delete 2>/dev/null | while read file; do
    echo "  Removed: $file"
    ((REMOVED_COUNT++))
done

# Remove section files
echo "Removing SECTION_* files..."
find . -name "SECTION_*.md" -type f -print -delete 2>/dev/null | while read file; do
    echo "  Removed: $file"
    ((REMOVED_COUNT++))
done

# Remove specific files
echo "Removing specific temporary files..."
rm -f ERRORS_FIXED_SUMMARY.md 2>/dev/null && echo "  Removed: ERRORS_FIXED_SUMMARY.md"
rm -f ml-models/*/IMPLEMENTATION_COMPLETE.md 2>/dev/null && echo "  Removed: IMPLEMENTATION_COMPLETE.md files"

echo ""
echo "✅ Cleanup complete!"
echo ""

# Count files after cleanup
AFTER_COUNT=$(find . -name "*.md" -type f | wc -l)
echo "Files after cleanup: $AFTER_COUNT"
echo "Files removed: $((BEFORE_COUNT - AFTER_COUNT))"
echo ""

# Show what's kept
echo "📚 Important documentation kept:"
echo "  ✓ README.md files"
echo "  ✓ API documentation (docs/api/)"
echo "  ✓ User guides (docs/user-guides/)"
echo "  ✓ Privacy policies"
echo "  ✓ Deployment guides"
echo "  ✓ Infrastructure guides"
echo "  ✓ Training materials"
echo ""

# Create summary file
cat > CLEANUP_SUMMARY.md << EOF
# Documentation Cleanup Summary

## Cleanup Date
$(date '+%Y-%m-%d %H:%M:%S')

## Files Removed
Total: $((BEFORE_COUNT - AFTER_COUNT)) files

## Files Kept
Total: $AFTER_COUNT markdown files

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
EOF

echo "📄 Created CLEANUP_SUMMARY.md with details"
echo ""
echo "Ready to push to GitHub! 🚀"
