# Testing Git Storage with Nested Folders

## Quick Test Procedure

### Test 1: Create Nested Page

1. **Login to Wiki.js** as admin or user with write permissions

2. **Create a new page** with nested path:
   - Click "New Page"
   - Enter path: `ru/virtualization/vmware-basics`
   - Enter title: "VMware Basics"
   - Add some content
   - Click "Create"

3. **Verify in Git repository:**
   ```bash
   cd /path/to/your/repo
   ls -la ru/virtualization/
   # Should show: vmware-basics.md
   
   cat ru/virtualization/vmware-basics.md
   # Should show page content with metadata
   ```

4. **Check Git log:**
   ```bash
   git log --oneline -5
   # Should show: docs: create ru/virtualization/vmware-basics
   ```

✅ **Expected:** Page created successfully with proper folder structure

---

### Test 2: Create Deeply Nested Page

1. **Create another page** with deeper nesting:
   - Path: `ru/databases/postgresql/replication/setup`
   - Title: "PostgreSQL Replication Setup"
   - Add content
   - Create

2. **Verify:**
   ```bash
   ls -la ru/databases/postgresql/replication/
   # Should show: setup.md
   ```

✅ **Expected:** Multiple nested folders created automatically

---

### Test 3: Delete and Restore Page

1. **Delete the page:**
   - Go to `ru/virtualization/vmware-basics`
   - Click page menu → "Delete"
   - Confirm deletion

2. **Verify deletion in Git:**
   ```bash
   cd /path/to/your/repo
   git log --oneline -1
   # Should show: docs: delete ru/virtualization/vmware-basics
   
   ls -la ru/virtualization/
   # vmware-basics.md should be gone
   ```

3. **Restore the file in Git:**
   ```bash
   # Find the commit where it was deleted
   git log --oneline --all -- ru/virtualization/vmware-basics.md
   
   # Revert the deletion (replace COMMIT_HASH with actual hash)
   git revert COMMIT_HASH --no-edit
   
   # Or restore manually from history
   git checkout HEAD~1 -- ru/virtualization/vmware-basics.md
   git commit -m "docs: restore ru/virtualization/vmware-basics"
   
   # Push if using remote
   git push
   ```

4. **Wait for sync** (or trigger manually in Admin → Storage → Git → Actions)

5. **Check Wiki.js:**
   - Navigate to `ru/virtualization/vmware-basics`
   - Page should be visible again with content

✅ **Expected:** Deleted page is restored and appears in Wiki.js

---

### Test 4: Move Page to New Nested Folder

1. **Move a page:**
   - Go to any existing page (e.g., `home`)
   - Click page menu → "Move/Rename"
   - New path: `ru/guides/getting-started/wiki-basics`
   - Save

2. **Verify:**
   ```bash
   ls -la ru/guides/getting-started/
   # Should show: wiki-basics.md
   
   git log --oneline -1
   # Should show: docs: rename home to ru/guides/getting-started/wiki-basics
   ```

✅ **Expected:** Page moved successfully, folders created

---

### Test 5: Sync Untracked Content

1. **Create some pages** without Git sync enabled temporarily

2. **Enable Git storage** (if not already enabled)

3. **Run sync untracked:**
   - Admin → Storage → Git
   - Actions → Sync Untracked Content

4. **Verify all pages exported:**
   ```bash
   cd /path/to/your/repo
   find . -name "*.md" | head -20
   # Should show all pages with proper nested structure
   
   git status
   # Should show all new files staged
   
   git log --oneline -1
   # Should show: docs: add all untracked content
   ```

✅ **Expected:** All pages exported with correct folder structure

---

## Automated Test Commands

### Quick Verification Script

Save as `test-git-folders.sh`:

```bash
#!/bin/bash

REPO_PATH="/path/to/your/wiki/repo"  # Update this!
cd "$REPO_PATH"

echo "=== Git Storage Folder Structure Test ==="
echo ""

# Test 1: Check for nested folders
echo "📁 Checking folder structure..."
find . -type d -name "*" | grep -v ".git" | head -10
echo ""

# Test 2: Check for nested page files
echo "📄 Checking nested page files..."
find . -name "*.md" | grep "/" | head -10
echo ""

# Test 3: Check recent commits
echo "📝 Recent Git commits:"
git log --oneline -5
echo ""

# Test 4: Check for specific test paths
echo "🔍 Checking test paths..."
if [ -d "ru/virtualization" ]; then
    echo "✅ ru/virtualization exists"
    ls -la ru/virtualization/
else
    echo "❌ ru/virtualization not found"
fi
echo ""

if [ -d "ru/databases/postgresql" ]; then
    echo "✅ ru/databases/postgresql exists"
    ls -la ru/databases/postgresql/
else
    echo "❌ ru/databases/postgresql not found"
fi
echo ""

echo "=== Test Complete ==="
```

Run:
```bash
chmod +x test-git-folders.sh
./test-git-folders.sh
```

---

## Expected File Structure

After running tests, your Git repo should look like:

```
repo/
├── .git/
├── ru/
│   ├── virtualization/
│   │   └── vmware-basics.md
│   ├── databases/
│   │   └── postgresql/
│   │       └── replication/
│   │           └── setup.md
│   └── guides/
│       └── getting-started/
│           └── wiki-basics.md
├── en/
│   └── ... (your English pages)
└── home.md
```

---

## Troubleshooting

### Pages Not Syncing

1. **Check Git storage is enabled:**
   - Admin → Storage → Git
   - Status should be "Active"

2. **Check sync interval:**
   - Default is 5 minutes
   - Can trigger manually via "Actions" menu

3. **Check logs:**
   ```bash
   # If running with npm/node
   tail -f /path/to/wiki/logs/wiki.log
   
   # If running with Docker
   docker logs -f wiki
   ```

4. **Look for errors like:**
   - `ENOENT: no such file or directory`
   - `Permission denied`
   - `Failed to process`

### Deleted Page Not Restored

1. **Verify file exists in Git:**
   ```bash
   cd /path/to/repo
   ls -la path/to/page.md
   ```

2. **Check file content:**
   ```bash
   cat path/to/page.md
   # Should have proper metadata header
   ```

3. **Manually trigger sync:**
   - Admin → Storage → Git → Actions
   - Click "Import Everything"

4. **Check Wiki.js logs:**
   - Look for: `(STORAGE/GIT) Page marked as new: path/to/page`

### Folders Not Created

1. **Check file system permissions:**
   ```bash
   ls -la /path/to/repo
   # Wiki.js process must have write permissions
   ```

2. **Check disk space:**
   ```bash
   df -h
   ```

3. **Manually test directory creation:**
   ```bash
   cd /path/to/repo
   mkdir -p test/nested/folders
   # Should succeed without errors
   ```

---

## Success Criteria

✅ All tests pass if:

1. ✅ Nested folders are created automatically when creating pages
2. ✅ Deleted pages can be restored from Git
3. ✅ Moving pages creates destination folders
4. ✅ Sync untracked content preserves folder structure
5. ✅ No errors in Wiki.js logs
6. ✅ Git repository has proper folder structure
7. ✅ All files are tracked in Git (no untracked files after sync)

---

## Additional Tests

### Test with Different Locales

```
ru/category/article
en/category/article
de/category/article
fr/category/article
```

All should create proper `locale/category/` folder structure.

### Test with Special Characters

Try creating pages with paths like:
- `ru/категория/статья` (Cyrillic - may be converted)
- `en/FAQ/Q&A` (special chars - may be sanitized)
- `en/guides/2024-updates` (numbers and dashes)

### Test with Assets

1. Upload an asset to nested path
2. Verify folder structure in repo
3. Delete asset
4. Restore from Git
5. Verify asset reappears

---

**Note:** Always backup your database and Git repository before testing!

**Testing Date:** November 11, 2025  
**Wiki.js Version:** 2.x  
**Status:** Ready for Testing

