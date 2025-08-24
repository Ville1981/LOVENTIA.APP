# i18n Audit Report (client)

**Root**: `/mnt/data/unzipped_client(2)/client`

## Summary
- Source files scanned: **165**
- i18n keys used (t-calls): **85**
- ⚠ Dot-syntax t("ns.key") leftovers: **162**
- useTranslation() dot misuse: **0**
- Namespaces seen in useTranslation: common, discover, lifestyle, profile

## Locales
Locales dir: `/mnt/data/unzipped_client(2)/client/public/locales`  
Languages detected: ar, bg, cs, da, de, el, en, es, et, fi, fr, he, hi, hu, it, ja, ko, lt, lv, nl, no, pl, pt, ro, ru, sk, sv, sw, tr, uk, ur, zh

### Missing keys per language (top 10 shown)
- en: 49 missing
- fi: 49 missing
- ar: 42 missing
- he: 42 missing
- hi: 42 missing
- sw: 42 missing
- ur: 42 missing
- bg: 37 missing
- cs: 37 missing
- da: 37 missing


## Files generated
- `i18n.used-keys.txt` — All `namespace:key` usages found.
- `i18n.dot-syntax-hits.txt` — Lines with `t("ns.key")` that need `:`.
- `i18n.useTranslation-dot-misuse.txt` — (if any) `useTranslation("ns.key")` occurrences.
- `i18n.useTranslation-namespaces.txt` — Unique namespaces used in `useTranslation`.
- `i18n.<lang>.missing.txt` — Missing keys for each language.
- `i18n.<lang>.unused.txt` — Keys present in locale files but not used.
- `codemod_fix_i18n_colon.mjs` — Safe auto-fix script for obvious dot→colon cases.

All files are in: `/mnt/data/unzipped_client(2)/client/__i18n_reports__`

## Quick preview of dot-syntax offenders (first 20)
```
cypress/integration/socket-reconnect.spec.js:div.p-2
src/components/ChildrenPetsFields.jsx:common.select
src/components/ChildrenPetsFields.jsx:common.other
src/components/ChildrenPetsFields.jsx:common.select
src/components/ChildrenPetsFields.jsx:pets.cat
src/components/ChildrenPetsFields.jsx:pets.dog
src/components/ChildrenPetsFields.jsx:pets.both
src/components/ChildrenPetsFields.jsx:common.other
src/components/ChildrenPetsFields.jsx:pets.none
src/components/ConversationCard.jsx:conversationCard.avatarAlt
src/components/ConversationList.jsx:chat.overview.loading
src/components/ConversationList.jsx:chat.overview.error
src/components/ConversationList.jsx:chat.overview.title
src/components/ConversationList.jsx:chat.overview.title
src/components/ConversationList.jsx:chat.overview.title
src/components/ConversationList.jsx:chat.overview.title
src/components/ConversationsOverview.jsx:chat.loading
src/components/ConversationsOverview.jsx:chat.overview.error
src/components/ConversationsOverview.jsx:chat.overview.retry
src/components/ConversationsOverview.jsx:chat.overview.retry
```

## How to run the codemod locally
```bash
# From your client root
node __i18n_reports__/codemod_fix_i18n_colon.mjs ./src

# Then re-scan using your Git grep or the earlier scripts
```
