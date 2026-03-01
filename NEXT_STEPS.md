# Next Steps

**Aktuální stav:** MVP implementace kompletní, build prochází, 13 unit testů zelených, kód na GitHubu.

---

## Priorita 1 – Integrace a ověření funkčnosti

### 1.1 Otestovat proti reálnému Passbolt serveru

Vyžaduje přístup k běžící Passbolt instanci (self-hosted nebo cloud).

```bash
export PASSBOLT_BASE_URL="https://passbolt.example.com"
export PASSBOLT_USER_ID="<uuid>"
export PASSBOLT_PRIVATE_KEY="$(cat ~/.gnupg/passbolt-private.asc)"
export PASSBOLT_PASSPHRASE="<passphrase>"

node dist/index.js
```

Ověřit manuálně pomocí MCP Inspector:
```bash
npm run inspect
```

### 1.2 Integration testy (volitelné)

Přidat `tests/integration/` s testy proti live nebo mock Passbolt API.
Možnosti:
- **MSW (Mock Service Worker)** – interceptovat HTTP volání, nepotřebovat živý server
- **Testcontainers** – spustit Passbolt v Docker kontejneru pro CI

---

## Priorita 2 – Publikace na NPM

```bash
# Zkontrolovat metadata v package.json (version, description, keywords)
npm pack --dry-run        # preview co bude publikováno

# Přihlásit se k NPM (pokud ještě ne)
npm login

# Publikovat
npm publish
```

Po publikaci přidat badge do README:
```markdown
[![npm version](https://badge.fury.io/js/passbolt-mcp-server.svg)](https://www.npmjs.com/package/passbolt-mcp-server)
```

---

## Priorita 3 – CI/CD (GitHub Actions)

Vytvořit `.github/workflows/ci.yml`:
- Spustit `npm run build` a `npm test` na každý push/PR
- Volitelně: auto-publish na NPM při tagu `v*`

Vzorový workflow:
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run build
      - run: npm test
```

---

## Priorita 4 – Vylepšení funkcionality

### 4.1 Podpora Passbolt v5 resource types

Passbolt v5 zavádí nové typy zdrojů (TOTP standalone, password+description, atd.).
Aktuálně hardcoded `669f8c64-242a-59fb-92fc-81f660975fd3` (password v4).

Přidat:
- Auto-detekci resource type UUID z `/resource-types.json` endpointu
- Mapování typ → správná serializace secretu

### 4.2 Bulk operace

Přidat tool `bulk_share_folder` – sdílet celou složku najednou místo resource po resource.

### 4.3 Tags podpora

Passbolt podporuje tagy na resources. Přidat:
- `list_tags` tool
- Filtrování `list_resources` podle tagu

### 4.4 Error handling vylepšení

Aktuálně chyby z API hází generické `Error`. Přidat:
- Typed error classes (`PassboltAuthError`, `PassboltNotFoundError`)
- Lepší error messages s HTTP status kódem

---

## Priorita 5 – Dokumentace

- Přidat `CONTRIBUTING.md` (jak přispívat, jak spustit lokálně)
- Přidat příklady do README (screenshoty MCP Inspector, ukázky výstupu tools)
- Přidat sekci "Troubleshooting" do README (časté problémy: špatný passphrase, self-signed cert, atd.)

---

## Technický dluh

| Soubor | Problém |
|---|---|
| `src/auth/jwt.ts` | Refresh token logic není otestována unit testy |
| `src/api/client.ts` | Chybí timeout na fetch volání |
| `src/handlers/shares.ts` | `shareResource` nenačítá armored keys pro skupiny (jen pro users) |

---

*Aktualizováno: 2026-03-01*
