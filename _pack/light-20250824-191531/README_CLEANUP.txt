Loventia — Client Cleanup Full Pack
==================================
This pack contains:
- src/i18n.js (with 'translation' namespace + fallbackNS and expanded SUPPORTED_LANGS)
- public/locales/{en,fi,sv,de,es,fr}/common.json (with home.* and nav.*)
- public/locales/*/{navbar,footer,chat}.json placeholders to stop 404s
- Cleanup instructions

HOW TO APPLY
1) Stop your dev server.
2) Extract this ZIP into your CLIENT folder (the one with package.json, src/, public/).
   Allow it to overwrite existing files.
3) Start dev server again:  npm run dev

CLEAN-UP (Safe to perform now)
Delete (or archive) obsolete i18n config files so ONLY src/i18n.js remains authoritative:
  - src/i18next.config.js
  - src/i18n/i18nConfig.js
  - src/i18n/config.js
These older files are no longer needed and can cause confusion/override risk.

OPTIONAL (Recommended later, manual step)
  - Remove or archive the duplicate folder 'client/client' if it exists in your repo root.
    Ensure no imports reference files there before deleting.
  - If you want to strictly use separate namespaces instead of translation.json, gradually
    move legacy keys from translation.json into appropriate files (common/profile/discover/lifestyle).

VERIFY
  - Language switch persists to localStorage key 'i18nextLng'
  - Home page shows home.title & home.subtitle
  - Navbar/Footer show nav.*
  - Network tab has no 404s for navbar/footer/chat.json

