# Wiki.js - Custom Fork 🚀

> Enhanced Wiki.js with Git Storage improvements, Approval Workflow, and Russian localization

This is a custom fork of [Wiki.js](https://github.com/Requarks/wiki) with significant enhancements and bug fixes.

## ✨ Key Features

### 🔧 Git Storage - Fixed & Enhanced

The biggest improvement! Git storage module now properly handles:

- ✅ **Nested folders** - Any depth (e.g., `ru/databases/postgresql/replication/setup.md`)
- ✅ **Deleted page restoration** - Pages deleted in Wiki.js and restored in Git sync correctly
- ✅ **Automatic directory creation** - Folders created automatically when creating pages
- ✅ **Robust error handling** - Graceful fallbacks for edge cases
- ✅ **Bidirectional sync** - Seamless Wiki.js ↔ Git synchronization

**Before:**
```
❌ Creating ru/virtualization/vmware fails (no parent dirs)
❌ Deleted pages don't restore from Git
❌ Errors with nested paths
```

**After:**
```
✅ Any nested structure works perfectly
✅ Deleted pages restore automatically
✅ Directories created on-the-fly
✅ Production-ready stability
```

### 📋 Page Approval Workflow

Complete moderation system for team wikis:

- ✅ **Approval Queue** - Review pending pages
- ✅ **Reviewer Comments** - Add notes for writers
- ✅ **Status Tracking** - DRAFT, PENDING, APPROVED, REJECTED
- ✅ **Permission System** - Role-based access control
- ✅ **History Integration** - Comments visible in page history

Perfect for:
- Corporate knowledge bases
- Documentation teams
- Multi-author wikis
- Quality control workflows

### 🌐 Russian Localization

Full Russian translations for:
- Common UI elements
- Approval workflow
- Admin panel
- Page moderation interface

Easy to add more languages following the same pattern!

### 🔐 Enhanced Permissions

- ✅ Writers can view their own page history
- ✅ Authors can see reviewer comments
- ✅ Fine-grained access control
- ✅ Page-level permission checks

### 📁 Folder Organization

- ✅ Create/delete folders
- ✅ Move pages between folders
- ✅ Folder-based navigation
- ✅ Tree structure visualization

### 🎨 UI/UX Improvements

- ✅ Fixed editor header button overflow
- ✅ Reviewer notes button in header
- ✅ Better comment card styling
- ✅ Fixed admin panel loading states
- ✅ Improved history page timeline

### 🐛 Bug Fixes

- ✅ Fixed XSS vulnerability in approvals
- ✅ Fixed duplicate comments
- ✅ Fixed label translations
- ✅ Fixed missing Close button
- ✅ Fixed Vue event naming issues

## 🚀 Quick Start

### Installation

```bash
# Clone this repository
git clone https://github.com/YOUR_USERNAME/wiki-fork.git
cd wiki-fork

# Install dependencies
npm install

# Configure database (config.yml)
cp config.sample.yml config.yml
# Edit config.yml with your database settings

# Build
npm run build

# Start
npm start
```

Access at: `http://localhost:3000`

### Docker

```bash
# Build image
docker build -t wiki-custom .

# Run
docker run -d \
  -p 3000:3000 \
  --name wiki \
  -e DB_TYPE=postgres \
  -e DB_HOST=db \
  -e DB_PORT=5432 \
  -e DB_USER=wikijs \
  -e DB_PASS=password \
  -e DB_NAME=wiki \
  wiki-custom
```

## 📝 Git Storage Configuration

### In Wiki.js Admin Panel

**Admin → Storage → Git**

```
Authentication Type: basic (or ssh)
Repository URI: https://github.com/your-org/wiki-content.git
Branch: main
Username: your-github-username
Password: [GitHub Personal Access Token]
Sync Direction: Bidirectional
Sync Interval: Every 5 minutes
```

### GitHub Token

1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scope: `repo`
4. Copy token and use as password in Wiki.js

### Example Structure

Your Git repository will look like:

```
wiki-content/
├── ru/
│   ├── virtualization/
│   │   ├── proxmox/
│   │   │   ├── installation.md
│   │   │   └── networking.md
│   │   └── vmware/
│   │       └── basics.md
│   ├── databases/
│   │   ├── postgresql/
│   │   │   ├── backup.md
│   │   │   └── replication.md
│   │   └── mysql/
│   │       └── setup.md
│   └── networking/
│       └── cisco/
│           └── configuration.md
└── en/
    └── guides/
        └── getting-started.md
```

**All folders created automatically!** ✨

## 📚 Documentation

- **[CHANGELOG.md](CHANGELOG.md)** - All changes from upstream
- **[GIT_STORAGE_FIXES.md](GIT_STORAGE_FIXES.md)** - Detailed Git storage documentation
- **[test-git-nested-folders.md](test-git-nested-folders.md)** - Testing procedures

## 🧪 Testing

All features tested with:

- ✅ Nested folders (10+ levels deep)
- ✅ Page CRUD operations
- ✅ Git bidirectional sync
- ✅ Approval workflow
- ✅ Multi-language content
- ✅ Permission system

## 🔄 Workflow Examples

### Content Creation

**1. Create page in Wiki.js:**
```
Path: ru/linux/ubuntu/firewall-setup
→ Automatically commits to Git
→ Creates folders: ru/linux/ubuntu/
→ File: ru/linux/ubuntu/firewall-setup.md
```

**2. Edit in Git:**
```bash
git clone https://github.com/your-org/wiki-content.git
cd wiki-content
nano ru/linux/ubuntu/firewall-setup.md
git commit -am "Update firewall guide"
git push
→ Wiki.js automatically pulls changes
→ Page updated in Wiki.js
```

### Approval Workflow

**Writer:**
1. Creates page → Status: DRAFT
2. Submits for review → Status: PENDING

**Reviewer:**
1. Views approval queue
2. Reviews content
3. Adds comments
4. Approves/Rejects

**Writer:**
1. Sees reviewer comments
2. Makes changes
3. Resubmits

## 💻 Development

```bash
# Development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## 📊 Statistics

**Changes from upstream:**
- 📝 **80+ files modified**
- ✨ **5+ new features**
- 🐛 **10+ bug fixes**
- 📄 **5000+ lines changed**
- 🌐 **2 new languages**

## 🤝 Contributing

This is a custom fork for specific use cases. If you want to contribute:

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

For upstream Wiki.js contributions, see: https://github.com/Requarks/wiki

## 🆘 Support

For issues specific to these custom features:
- Open an issue in this repository

For general Wiki.js questions:
- [Official Wiki.js Documentation](https://docs.requarks.io/)
- [Wiki.js Discussions](https://github.com/requarks/wiki/discussions)

## 📜 License

Same as upstream Wiki.js: **AGPL-3.0**

This fork maintains the original license. See [LICENSE](LICENSE) file.

## 🙏 Credits

**Original Wiki.js:**
- Created by [Nicolas Giard](https://github.com/NGPixel)
- Repository: https://github.com/Requarks/wiki

**This Fork:**
- Custom development for enhanced Git storage
- Approval workflow implementation
- Russian localization
- Various UI/UX improvements

## 🔗 Links

- [Upstream Wiki.js](https://github.com/Requarks/wiki)
- [Wiki.js Website](https://js.wiki/)
- [Official Documentation](https://docs.requarks.io/)

---

**⭐ If this fork helps you, please star the repository!**

**Made with ❤️ for the Wiki.js community**
