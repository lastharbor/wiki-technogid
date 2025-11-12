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

