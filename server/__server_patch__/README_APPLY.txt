This patch enables optional serving of i18n locale JSONs from the server at /locales.
Usage:
1) Merge the modified files into your server project (same paths).
2) Set USE_SERVER_LOCALES=true in your .env if you want the server to serve locales.
   - Keep it false if your client serves locales from its /public/locales.
3) Restart server.
4) Ensure your client i18n loadPath is /locales/{{lng}}/{{ns}}.json when using server-hosted locales.

Changed/added:
- src/app.js (added conditional /locales static)
- .env.example (added USE_SERVER_LOCALES=false)
