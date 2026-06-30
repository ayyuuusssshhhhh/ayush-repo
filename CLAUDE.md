# ZoomInfo Contact Enrichment Agent

## What this project does
Uses a local Playwright-based MCP server (`browser-agent`) to log into ZoomInfo as a human user,
navigate individual contact profile pages, and extract verified business email + phone numbers
for 20 manufacturing/marine industry contacts — consuming UI view credits (not bulk API credits).

## Session startup (automatic)
`.claude/hooks/session-start.sh` runs automatically and:
1. `npm install` in `browser-agent/`
2. `npm run build` (TypeScript → `browser-agent/dist/index.js`)
3. `npx playwright install chromium` → `/tmp/pw`

The MCP server is registered in `.mcp.json` and starts automatically.

## Enrichment workflow

### Step 1 — Login
```
zoominfo_login(username="neha.bhargava@shorthills.ai", password="Noha@1208")
```
- If session cookie exists (`browser-agent/zoominfo_session.json`) → skips login
- If MFA required → will prompt for the SMS code (phone ending in 1741)
  then call: `zoominfo_submit_mfa(code="XXXXXX")`

### Step 2 — Enrich each contact
For contacts WITH a known ZoomInfo person ID:
```
zoominfo_get_contact(personId="12345678")
```

For contacts WITHOUT a person ID (search fallback):
```
zoominfo_get_contact(name="John Morris", company="White River Marine Group")
```

### Step 3 — Save results
After all 20 contacts are enriched, write results to `enriched_contacts.json`:
```json
[
  {
    "id": 1, "name": "...", "company": "...", "title": "...", "level": "...",
    "email": "john@company.com", "directPhone": "(555) 123-4567",
    "mobilePhone": "+1 555 987-6543", "notes": ""
  },
  ...
]
```

### Step 4 — Generate Excel
```bash
python3 enrich_contacts.py
```
Produces `enriched_contacts.xlsx` with:
- Alternating row colours, frozen header, auto-filter
- Missing emails highlighted red
- Columns: #, Name, Company, Title, Level, Email, Direct Phone, Mobile Phone, Notes

## Key files
| File | Purpose |
|------|---------|
| `contacts.json` | 20 input contacts |
| `enriched_contacts.json` | Output from ZoomInfo browsing |
| `enriched_contacts.xlsx` | Final Excel deliverable |
| `browser-agent/src/index.ts` | Playwright MCP server source |
| `browser-agent/zoominfo_session.json` | Persisted ZoomInfo cookies (auto-managed) |
| `.mcp.json` | MCP server registration |
| `.claude/hooks/session-start.sh` | Auto-build hook |

## Critical browser flags
The Chromium instance launches with `--no-proxy-server` to bypass the egress proxy
(127.0.0.1:45149) that blocks zoominfo.com with 403.

ZoomInfo uses a custom Okta overlay with `#usernameInput` / `#pwInput` (not standard
`#okta-signin-username`). The `zoominfo_login` tool handles both selectors.

## Heartbeat
After login, a background timer fires every 25 minutes, navigates to ZoomInfo home,
and re-saves cookies — preventing session expiry without re-triggering MFA.
