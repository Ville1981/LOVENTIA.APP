# Loventia Server Diagnostics (PowerShell)

These scripts are meant for quick, repeatable checks during development or CI troubleshooting.
They use **Invoke-RestMethod** and assume a local backend at `http://localhost:5000` unless overridden.

## Scripts

- `health.ps1` — Ping `/health` and basic service checks.
- `auth.ps1` — Login, call `/api/auth/me`, `/api/me`, and `/api/users/me`.
- `billing.ps1` — Minimal Stripe flow checks (mock mode supported).
- `images.ps1` — Demonstrates image upload, delete by slot, delete by path, reorder, and set avatar.

## Usage

Open **PowerShell** in the `server/docs/diagnostics` folder and run:

```powershell
# Health
.\health.ps1

# Auth (provide your test email/password)
.\auth.ps1 -BaseUrl "http://localhost:5000" -Email "testuser1@example.com" -Password "yourPassword123!"

# Billing (mock mode on by default)
.\billing.ps1 -BaseUrl "http://localhost:5000" -StripeMock 1

# Images (requires a valid userId and a real file path)
.\images.ps1 -BaseUrl "http://localhost:5000" -Token "<JWT>" -UserId "<MongoId>" -FilePath "C:\Temp\sample.jpg"
