#!/bin/bash
#
# Wiki.js Build Script
# Собирает клиентские ассеты
#

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║  Wiki.js - Building Client Assets                             ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "   Please install Node.js 14.x or later"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js version: $NODE_VERSION"
echo ""

# Проверка Python для нативных модулей (sqlite3)
echo "🔍 Checking system dependencies..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    echo "   Python: $PYTHON_VERSION"

    # Проверка distutils для Python 3.12+
    if ! python3 -c "import distutils" 2>/dev/null; then
        echo "   ⚠️  Warning: Python distutils not found"
        echo "   Installing python3-setuptools..."

        # Определяем систему (ALT Linux vs Debian/Ubuntu)
        if [ -f /etc/altlinux-release ]; then
            # ALT Linux (без sudo если уже root)
            echo "   Detected: ALT Linux"
            if [ "$EUID" -eq 0 ]; then
                apt-get update -qq && apt-get install -y python3-module-setuptools python3-module-distutils gcc gcc-c++ make 2>/dev/null || true
            else
                sudo apt-get update -qq && sudo apt-get install -y python3-module-setuptools python3-module-distutils gcc gcc-c++ make 2>/dev/null || true
            fi
        elif command -v apt-get &> /dev/null; then
            # Debian/Ubuntu
            echo "   Detected: Debian/Ubuntu"
            if [ "$EUID" -eq 0 ]; then
                apt-get update -qq && apt-get install -y python3-setuptools python3-dev build-essential 2>/dev/null || true
            else
                sudo apt-get update -qq && sudo apt-get install -y python3-setuptools python3-dev build-essential 2>/dev/null || true
            fi
        elif command -v dnf &> /dev/null; then
            # Fedora/RHEL 8+
            echo "   Detected: Fedora/RHEL"
            if [ "$EUID" -eq 0 ]; then
                dnf install -y python3-setuptools python3-devel gcc gcc-c++ make 2>/dev/null || true
            else
                sudo dnf install -y python3-setuptools python3-devel gcc gcc-c++ make 2>/dev/null || true
            fi
        elif command -v yum &> /dev/null; then
            # CentOS/RHEL 7
            echo "   Detected: CentOS/RHEL"
            if [ "$EUID" -eq 0 ]; then
                yum install -y python3-setuptools python3-devel gcc gcc-c++ make 2>/dev/null || true
            else
                sudo yum install -y python3-setuptools python3-devel gcc gcc-c++ make 2>/dev/null || true
            fi
        else
            echo "   ⚠️  Please install python3-setuptools manually:"
            echo "      ALT Linux:     apt-get install python3-module-setuptools python3-module-distutils gcc gcc-c++ make"
            echo "      Debian/Ubuntu: apt-get install python3-setuptools python3-dev build-essential"
            echo "      RHEL/CentOS:   dnf install python3-setuptools python3-devel gcc gcc-c++ make"
        fi
    else
        echo "   ✅ Python distutils available"
    fi
else
    echo "   ⚠️  Warning: Python 3 not found"
    echo "   Some native modules (sqlite3) may fail to install"
fi

# Проверка build tools
if ! command -v make &> /dev/null; then
    echo "   ⚠️  Warning: build-essential not found (needed for native modules)"
fi

echo ""

# Установка зависимостей (если нужно)
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --legacy-peer-deps
    echo ""
fi

# Сборка клиента
echo "🔨 Building client assets..."

# Определяем версию Node.js
NODE_MAJOR_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')

# Для Node.js 17+ нужен --openssl-legacy-provider
if [ "$NODE_MAJOR_VERSION" -ge 17 ]; then
    echo "   Node.js $NODE_MAJOR_VERSION detected, using legacy OpenSSL provider"
    npm run build:legacy
else
    echo "   Node.js $NODE_MAJOR_VERSION detected, building without legacy provider"
    npm run build
fi

echo ""
echo "✅ Build completed successfully!"
echo ""
echo "Next step:"
echo "  ./start.sh    # Start the server"
echo ""

