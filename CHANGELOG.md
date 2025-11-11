# Wiki.js - Custom Fork with Enhancements

## Changes from upstream Wiki.js

### 🚀 Git Storage Module - Major Improvements

**Fixed nested folder support for Git sync**
- ✅ Added automatic directory creation with `fs.ensureDir()`
- ✅ Fixed deleted pages restoration when pulling from Git
- ✅ Improved error handling for rename/delete operations
- ✅ Support for unlimited folder nesting depth (e.g., `ru/databases/postgresql/replication/setup`)

**Files changed:**
- `server/modules/storage/git/storage.js` - Main Git storage module
  - Added directory creation in `created()`, `updated()`, `renamed()`, `syncUntracked()` methods
  - Fixed `processFiles()` logic to handle restored files
  - Added fallback handling for failed operations

### 📋 Page Approval Workflow

**Complete approval system for content moderation**
- ✅ Page approval queue with filtering
- ✅ Reviewer comments system
- ✅ Status tracking (DRAFT, PENDING, APPROVED, REJECTED)
- ✅ Permission-based access control
- ✅ History integration with approval comments

**Files changed:**
- `client/components/approvals.vue` - Approval queue UI
- `server/db/migrations/*-approvals.js` - Database schema
- `server/graph/resolvers/page.js` - Approval mutations
- `server/graph/schemas/page.graphql` - GraphQL schema
- `server/models/pages.js` - Page model with approval fields

### 🌐 Russian Localization

**Added Russian translations**
- ✅ Common UI elements
- ✅ Approval workflow
- ✅ Admin panel
- ✅ Page moderation

**Files changed:**
- `server/locales/ru.yml` - Russian translations
- `server/locales/en.yml` - English translations
- `client/modules/localization.js` - i18n configuration
- `server/app/data.yml` - Locale namespaces

### 🔐 Enhanced Permissions

**Improved access control**
- ✅ Writers can view their own page history and comments
- ✅ Authors can see approval comments
- ✅ Page-level permission checks

**Files changed:**
- `server/graph/schemas/page.graphql` - Updated auth directives
- `server/graph/resolvers/page.js` - Added author checks
- `server/controllers/common.js` - Approval data population

### 📁 Page Folders Support

**Folder organization system**
- ✅ Create/delete folders
- ✅ Move pages between folders
- ✅ Folder-based navigation

**Files changed:**
- `server/db/migrations/*-page-folders.js` - Database schema
- `server/models/pages.js` - Folder methods

### 🎨 UI Improvements

**Editor enhancements**
- ✅ Reviewer notes button in header
- ✅ Fixed button overflow issues
- ✅ Icon-only buttons for compact layout
- ✅ Better comment visibility

**Admin panel improvements**
- ✅ Fixed infinite loading states
- ✅ Correct status chip display
- ✅ Better pending/published distinction

**History page improvements**
- ✅ Styled reviewer comment cards
- ✅ Version-specific comments
- ✅ Fixed context menu visibility
- ✅ Better timeline presentation

### 🐛 Bug Fixes

- ✅ Fixed XSS vulnerability in approvals page (added DOMPurify)
- ✅ Fixed duplicate comments in editor and history
- ✅ Fixed Vue custom event naming (kebab-case)
- ✅ Fixed label translation loading
- ✅ Fixed trailing spaces in Git storage module
- ✅ Fixed missing "Close" button in editor header

### 📝 Frontmatter Support

**Full YAML frontmatter support for Markdown and HTML**
- ✅ Automatic frontmatter injection when exporting to Git
- ✅ Automatic parsing when importing from Git
- ✅ Supports all metadata fields (title, description, tags, published, dates)
- ✅ Works seamlessly with Git Storage module
- ✅ Error handling with graceful fallback

**Supported fields:**
- `title` - Page title
- `description` - Page description
- `published` - Publication status (boolean)
- `date` - Update date (ISO 8601)
- `tags` - Tags (comma-separated string or array)
- `editor` - Editor type (markdown/html)
- `dateCreated` - Creation date (ISO 8601)

**Files:**
- `server/models/pages.js` - `extractFrontmatter()` and `parseMetadata()` methods
- `server/helpers/page.js` - `injectPageMetadata()` method
- `server/modules/storage/disk/common.js` - Uses `parseMetadata()` for imports
- `FRONTMATTER_SUPPORT.md` - Complete documentation

### 📚 Documentation

**Added comprehensive docs**
- `GIT_STORAGE_FIXES.md` - Detailed Git storage fix documentation
- `test-git-nested-folders.md` - Testing guide
- `FRONTMATTER_SUPPORT.md` - Frontmatter usage guide
- `CHANGELOG.md` - This file

## Installation

```bash
# Clone this fork
git clone https://github.com/YOUR_USERNAME/wiki-fork.git
cd wiki-fork

# Install dependencies
npm install

# Build
npm run build

# Start
npm start
```

## Git Storage Configuration

Use these settings in Wiki.js Admin → Storage → Git:

```
Repository URI: your-git-repo-url
Branch: main
Authentication Type: basic or ssh
Sync Direction: Bidirectional
```

**Nested folder structure now works perfectly:**
```
repo/
├── ru/
│   ├── virtualization/
│   │   └── vmware/
│   │       └── installation.md
│   └── databases/
│       └── postgresql/
│           └── replication/
│               └── setup.md
└── en/
    └── guides/
```

## Testing

All Git storage features tested with:
- ✅ Nested folders (any depth)
- ✅ Page creation in nested paths
- ✅ Page deletion and restoration
- ✅ Page renaming with folder creation
- ✅ Bidirectional sync (Wiki.js ↔ Git)

## Credits

Based on [Wiki.js](https://github.com/Requarks/wiki) by Nicolas Giard

**Enhancements by:** Custom Development Team
**Version:** 2.x-custom
**Date:** November 11, 2025

## License

Same as upstream Wiki.js (AGPL-3.0)
