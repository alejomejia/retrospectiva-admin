# Localization

The product has three localizable surfaces and they have different
language requirements. This doc maps them all out.

## The three surfaces

| Surface | Language(s) | Why |
| --- | --- | --- |
| **Admin UI** (this repo) | **Spanish only** | The primary user is Spanish-speaking. No locale toggle, no English fallback. |
| **Etsy listing** | **Primary: English** · **Secondary: Spanish** | The shop targets EU buyers (not Spain-domestic). English maximises Etsy discoverability; Spanish goes through `updateListingTranslation` (`es` locale). |
| **Public website** (`retrospectiva-website`, separate repo) | **Bilingual EN + ES** | The visitor picks. Both versions delivered via the Phase 7 webhook payload. |

## Admin UI

### Where strings live

All user-facing strings are in **`src/lib/i18n/messages.es.ts`** — a
single object `m` nested by surface:

```ts
m.common.signOut                       // "Cerrar sesión"
m.login.signInButton                   // "Entrar"
m.products.statuses.draft              // "borrador"
m.toasts.productSaved                  // "Producto guardado como borrador"
m.errors.invalidCredentials            // "Credenciales no válidas."
m.toasts.mediaUploaded(2, 1)           // "Subido: 2 fotos y 1 vídeo"
m.uploader.media.hintVideos(100, 30)   // "Vídeos · MP4 … · máx. 100 MB y 30 s · …"
```

Static strings are literal; parameterized strings are functions that
return strings (so callers can interpolate dynamic values into
Spanish-grammar-correct templates).

### What stays in English

Three categories are explicitly NOT translated:

1. **Dev-facing errors** thrown deep in the stack — parser throws in
   `users.ts`, R2 safety throws in `delete-prefix.ts`, jose error
   messages caught and logged via `devWarn`. These reach the server
   console (only the dev sees them), not the user.
2. **Brand mark** "Retrospectiva Admin" on the login page and sidebar.
   It's the brand, not copy.
3. **Code comments + JSDoc.** Project documentation language is
   English regardless of the UI language.

When a Spanish error toast *contains* a dev-facing detail (e.g.
"Authentication is misconfigured: ALLOW_USERS hash did not decode…"),
the prefix is Spanish (from `m.errors.*`) and the wrapped detail
stays English. The user (Alejandro, bilingual) reads both; the main user
(Spanish-only) at least understands the "something is wrong with
auth" prefix and can flag it.

### How to add a new string

1. Add the key to `messages.es.ts` under the appropriate surface
   group. Static → string literal; dynamic → function.
2. Import `m` from `@/lib/i18n/messages.es` in your component / action.
3. Reference as `m.products.detail.fieldName` or `m.toasts.foo(arg)`.

### Why centralized (vs hardcoded JSX strings)

Two reasons:
- **Future EN fallback.** If we ever need bilingual admin, adding
  `messages.en.ts` + a small `t()` resolver is a mechanical change.
  Strings are already located.
- **Consistency.** "Are we sure we say 'Eliminar' for delete in every
  card?" — a `grep` of `m.common.delete` answers it.

### What about UI dates and numbers?

- **Prices:** `formatCents` defaults to `en-IE` locale (`€49.99`).
  See [media-handling.md](../ai/media-handling.md) for the rationale on
  why prices stay dot-decimal even though the admin is Spanish.
- **Dates:** Used via `.toLocaleString("es-ES")` at the consumer
  level. The R2 date partition uses `Europe/Madrid` for the same
  reason.

## Etsy listing

### Direction

```
admin user types in Spanish
        │
        ▼
AI prompt (Phase 6) sees: Spanish input + photos
        │ single Responses API call, vision-enabled
        ▼
AI returns: {
  en: { title, description, tags[], materials[] },
  es: { title, description, tags[], materials[] }
}
        │
        ▼
Etsy publish (Phase 4):
  - createDraftListing with EN payload    ← primary
  - updateListingTranslation(es, …)       ← secondary
  - state = "active"
```

**English is the canonical/primary** listing copy because:
- EU buyers searching on Etsy use English far more than Spanish.
- Etsy SEO weights the primary listing language.
- The Spanish translation still appears for visitors who set the
  store-front language to Spanish.

### One AI call, two locales

The prompt is engineered to produce both locales in one Responses API
call — keeps OpenAI cost low and guarantees the EN/ES versions
describe the same garment from a shared context (era, fabric,
condition). Phase 6 will land the prompt template; see roadmap.md.

## Public website

Out of scope for this repo, but the contract:

### Outbound webhook payload (Phase 7)

```
POST $WEBSITE_WEBHOOK_URL
X-Retrospectiva-Signature: <HMAC-SHA256 over body>

{
  "event": "published" | "updated" | "sold",
  "productId": "uuid",
  "etsyListingId": 1234567890,
  "slug": "wool-coat-1970s",
  "en": { "title": "…", "description": "…", "tags": [ … ] },
  "es": { "title": "…", "description": "…", "tags": [ … ] },
  "priceCents": 14999,
  "currency": "EUR",
  "images": [ { "url": "…", "alt": "…" }, … ],
  "video": { "url": "…", "posterUrl": "…" } | null,
  "ts": "2026-05-15T14:00:00Z"
}
```

The website caches both locales and serves whichever the visitor
picks. Bilingual by design — never has to ask the admin back.

### Why HMAC + shared secret

`WEBSITE_WEBHOOK_SECRET` is shared between this admin and the public
website. Both sides compute HMAC-SHA256 of the raw body using the
secret; the website's webhook endpoint verifies. Prevents random POSTs
from triggering revalidation.

## Edge cases worth knowing

### "Sin título" placeholder

When the user clicks "Nuevo producto", the route handler at
`/products/new/route.ts` auto-creates a draft with `name: "Sin título"`
and `priceCents: 0`, then redirects to the detail page in edit mode.
The placeholder string is hardcoded in `src/lib/products/actions.ts`
— it can't be exported from a `"use server"` file as a non-async
constant, so the docstring there documents the value for future
maintenance.

Phase 9 cleanup job (when written) should grep for that literal to
sweep orphan drafts.

### Date formatting in R2 paths

`src/lib/integrations/r2/keys.ts` → `formatDatePrefix` uses
`Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", … })`. The
`en-CA` locale is chosen for its ISO-ish format
(YYYY-MM-DD) — the timezone is what we care about, not the locale's
name.

### Currency formatting

`src/lib/utils/money.ts` → `formatCents` defaults to `en-IE` so prices
read `€49.99` (English-style decimal). The admin user types `49.99`
in the price input (dot, not comma) — see `MONEY_STRING_RE`. This is
a conscious choice: matching Etsy's API expectation (dot decimals) is
worth a small inconsistency with Spanish locale convention.
