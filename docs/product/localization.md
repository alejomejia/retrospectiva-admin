# Localization

The product has three localizable surfaces and they have different
language requirements. This doc maps them all out.

## The three surfaces

| Surface | Language(s) | Why |
| --- | --- | --- |
| **Admin UI** (this repo) | **English only** | The admin authors in English (English-first). No locale toggle, no Spanish fallback. |
| **Etsy listing** | **Primary: English** · **Secondary: Spanish** | The shop targets EU buyers (not Spain-domestic). English maximises Etsy discoverability; Spanish goes through `updateListingTranslation` (`es` locale). |
| **Public website** (`retrospectiva-website`, separate repo) | **Bilingual EN + ES** | The visitor picks. Both versions delivered via the Phase 7 webhook payload. |

## Admin UI

### Where strings live

All user-facing strings are in **`src/lib/i18n/messages.en.ts`** — a
single object `m` nested by surface:

```ts
m.common.signOut                       // "Sign out"
m.login.signInButton                   // "Sign in"
m.products.statuses.draft              // "Draft"
m.toasts.productSaved                  // "Product saved as draft"
m.errors.invalidCredentials            // "Invalid credentials."
m.toasts.mediaUploaded(2, 1)           // "Uploaded: 2 photos and 1 video"
m.uploader.media.hintVideos(100, 30)   // "Videos · MP4 … · max 100 MB and 30 s · …"
```

Static strings are literal; parameterized strings are functions that
return strings (so callers can interpolate dynamic values into
grammar-correct templates).

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

### How to add a new string

1. Add the key to `messages.en.ts` under the appropriate surface
   group. Static → string literal; dynamic → function.
2. Import `m` from `@/lib/i18n/messages.en` in your component / action.
3. Reference as `m.products.detail.fieldName` or `m.toasts.foo(arg)`.

### Why centralized (vs hardcoded JSX strings)

Two reasons:
- **Future locale.** If we ever need a bilingual admin, adding a
  sibling `messages.<locale>.ts` + a small `t()` resolver is a
  mechanical change. Strings are already located.
- **Consistency.** "Are we sure we say 'Delete' in every card?" — a
  `grep` of `m.common.delete` answers it.

### What about UI dates and numbers?

- **Prices:** `formatCents` defaults to `en-IE` locale (`€49.99`).
  See [media-handling.md](../ai/media-handling.md) for the rationale on
  dot-decimal prices.
- **Dates:** The R2 date partition uses `Europe/Madrid`.

## Etsy listing

### Direction

```
admin user authors in English
        │
        ▼
AI enrichment sees: English input + photos
        │ single Responses API call, vision-enabled
        ▼
AI returns English: { titleEn, descriptionEn, etsyTagsEn, etsyMaterialsEn }
  → written to the canonical *_en columns
        │
        ▼
Etsy publish:
  - translate *_en → *_es inline (EN → ES translation queue)
  - createDraftListing with EN payload    ← primary (canonical *_en)
  - updateListingTranslation(es, …)       ← secondary (derived *_es)
  - state = "active"
```

**English is the canonical/primary** listing copy because:
- EU buyers searching on Etsy use English far more than Spanish.
- Etsy SEO weights the primary listing language.
- The Spanish translation still appears for visitors who set the
  store-front language to Spanish.

### Enrichment generates English; translation derives Spanish

Enrichment (`runEnrichment`) generates the canonical English fields
directly. The Spanish counterparts are produced by the translation
queue (`runTranslation`, EN → ES) inline at the Etsy-publish boundary,
so both locales describe the same garment and the derived `*_es`
columns exist only when a product is actually published.

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

### "Untitled" placeholder

When the user clicks "New product", the route handler at
`/products/new/route.ts` auto-creates a draft with null title fields,
then redirects to the detail page in edit mode. Lists and the detail
header render `m.products.detail.untitled` ("Untitled") whenever both
`titleEn` and `titleEs` are empty — the placeholder is UI-only, never
persisted as a title value.

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
