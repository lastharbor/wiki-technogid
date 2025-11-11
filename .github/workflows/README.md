# GitHub Actions Workflows

## Release Workflow

### Автоматическая сборка релизов

Workflow `release.yml` автоматически собирает production-ready релизы.

### Как использовать

#### Способ 1: Создание тега (автоматический релиз)

```bash
# Создайте и отправьте тег версии
git tag -a v2.6.0 -m "Release v2.6.0 - Production build"
git push origin v2.6.0
```

GitHub Actions автоматически:
1. Соберёт проект (`npm run build`)
2. Установит production зависимости
3. Создаст структуру релиза без данных в `data/`
4. Упакует в `tar.gz` и `zip` архивы
5. Вычислит SHA256 checksums
6. Создаст GitHub Release с файлами

#### Способ 2: Ручной запуск

1. Откройте вкладку "Actions" в GitHub
2. Выберите "Build Release"
3. Нажмите "Run workflow"
4. Выберите ветку
5. Нажмите "Run workflow"

Артефакты будут доступны в разделе workflow (хранятся 30 дней).

### Что включается в релиз

✅ **Включается:**
- `assets/` - собранные клиентские файлы
- `server/` - серверный код
- `node_modules/` - все production зависимости
- `package.json` - описание проекта
- `config.sample.yml` - пример конфигурации
- `LICENSE` - лицензия
- `README.md` - документация
- `CHANGELOG.md` - история изменений
- `data/` - **пустые** директории (только структура)

❌ **Исключается:**
- `data/wiki.sqlite*` - база данных
- `data/cache/*` - кеш
- `data/uploads/*` - загруженные файлы
- `data/repo/*` - Git репозиторий
- `.git/` - история Git
- `*.map` - source maps
- `test/`, `__tests__/` - тестовые файлы
- `.DS_Store`, `Thumbs.db` - системные файлы

### Результат

После запуска workflow создаст:

```
wiki-js-v2.6.0.tar.gz           (~250 MB)
wiki-js-v2.6.0.tar.gz.sha256    (checksum)
wiki-js-v2.6.0.zip              (~380 MB)
wiki-js-v2.6.0.zip.sha256       (checksum)
checksums.txt                   (сводка)
```

### Проверка целостности

```bash
# Проверка tar.gz
sha256sum -c wiki-js-v2.6.0.tar.gz.sha256

# Проверка zip
sha256sum -c wiki-js-v2.6.0.zip.sha256
```

### Установка из релиза

```bash
# Скачайте архив из GitHub Releases
wget https://github.com/YOUR_USERNAME/wiki-fork/releases/download/v2.6.0/wiki-js-v2.6.0.tar.gz

# Проверьте checksum (опционально)
wget https://github.com/YOUR_USERNAME/wiki-fork/releases/download/v2.6.0/wiki-js-v2.6.0.tar.gz.sha256
sha256sum -c wiki-js-v2.6.0.tar.gz.sha256

# Распакуйте
tar -xzf wiki-js-v2.6.0.tar.gz
cd release-build

# Настройте
cp config.sample.yml config.yml
nano config.yml

# Запустите (npm install НЕ НУЖЕН!)
node server
```

### Требования

- Node.js 14.x или выше (18.x рекомендуется)
- npm (для сборки)
- GitHub Actions runner: `ubuntu-latest`

### Кастомизация

Отредактируйте `.github/workflows/release.yml` для изменения:
- Node.js версии
- Списка включаемых/исключаемых файлов
- Формата release notes
- Параметров сжатия

### Troubleshooting

**Проблема:** Build fails on `npm run build`
**Решение:** Проверьте, что в `package.json` есть скрипт `build`

**Проблема:** Release не создаётся автоматически
**Решение:** Убедитесь, что тег начинается с `v` (например, `v2.6.0`)

**Проблема:** Архив слишком большой
**Решение:** Раскомментируйте `npm prune --production` в workflow

### Дополнительные ресурсы

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [softprops/action-gh-release](https://github.com/softprops/action-gh-release)
- [actions/upload-artifact](https://github.com/actions/upload-artifact)
