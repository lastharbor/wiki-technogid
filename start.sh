#!/bin/bash
#
# Wiki.js Start Script
# Запускает сервер
#

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║  Wiki.js - Starting Server                                    ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "   Please install Node.js 14.x or later"
    exit 1
fi

# Проверка config.yml
if [ ! -f "config.yml" ]; then
    echo "⚠️  config.yml not found!"
    echo ""
    echo "Creating config.yml from sample..."
    cp config.sample.yml config.yml
    echo ""
    echo "✅ config.yml created!"
    echo ""
    echo "⚠️  IMPORTANT: Please edit config.yml before starting:"
    echo "   1. Set database connection (PostgreSQL, MySQL, SQLite, etc)"
    echo "   2. Set port (default: 3000)"
    echo "   3. Set other options as needed"
    echo ""
    echo "After editing config.yml, run:"
    echo "  ./start.sh"
    echo ""
    exit 0
fi

# Проверка сборки
if [ ! -d "assets" ]; then
    echo "❌ Client assets not found!"
    echo "   Please run build first:"
    echo "   ./build.sh"
    exit 1
fi

# Запуск сервера
echo "🚀 Starting Wiki.js server..."
echo ""
node server

