# Etsy developer app — one-time registration

The admin panel publishes to Etsy via Open API v3. That requires a
registered **developer app** — a separate thing from your shop. This
doc walks you through registering one and producing the four env vars
the admin needs.

The whole flow is ~10 minutes. You'll come out with these four values
to paste into `.env.local`:

```
ETSY_CLIENT_ID=
ETSY_CLIENT_SECRET=
ETSY_REDIRECT_URI=http://localhost:3000/api/etsy/oauth/callback
ETSY_SHOP_ID=                # optional — populated by the first OAuth connect
```

## 1 · Confirm the prerequisites

You need:

- An Etsy account that owns or has admin access to the Retrospectiva
  shop.
- The account confirmed via email + seller registration complete.
  Etsy refuses to register apps for accounts that aren't seller-ready.

Sign in at <https://www.etsy.com> as that account before continuing.

## 2 · Open the developer portal

Visit <https://www.etsy.com/developers/your-apps> while logged in.
The first visit shows a one-page developer agreement — accept it.

You land on an empty "Your Apps" page with a **"Create a New App"**
button.

## 3 · Create the app

Click **"Create a New App"** and fill the form. The exact field names
shift over time; the gist is:

| Asked for | Suggested answer |
| --- | --- |
| **App name** | `Retrospectiva Admin` |
| **App description** | "Internal admin panel for the Retrospectiva vintage shop. The shop owner uses it to draft listings, AI-enrich them, and publish to Etsy. Single shop, single seller account." |
| **What will users do with your app?** | Same answer — emphasize *single shop, internal use*. |
| **Will it be sold or made publicly available?** | **No.** |
| **Will it expose Etsy data publicly?** | **No** (the admin is gated behind our own login). |
| **Personal use or commercial?** | **Personal.** This auto-approves at lower rate limits and skips Etsy's commercial review. |

Submit. The app shows up immediately in your dashboard with a
status of **"Pending Personal Approval"**.

> **Heads-up — the keystring exists but doesn't work yet.** Etsy
> reviews every app, including personal-use ones. While the status
> is "Pending Personal Approval", attempting OAuth fails with
> `"The application that is requesting authorization to use your
> Etsy account is not recognized"`. This is not a config error —
> Etsy literally hasn't activated the keystring in their OAuth
> system. Approval timing in our experience: hours to a couple of
> days. You'll get an email; the dashboard status flips to
> **"Approved"** at that point and OAuth starts working.

> **Why personal, not commercial.** Commercial apps go through a
> separate (longer) review and need a public privacy policy +
> support contact. Personal apps are capped at ~5,000 API calls/day
> and 10/sec — easily 100× our worst-case load (30 products/week,
> ~15 API calls each).

## 4 · Copy the keystring + shared secret

The newly created app's detail page shows two secrets:

- **Keystring** → this is your `ETSY_CLIENT_ID`.
- **Shared secret** → this is your `ETSY_CLIENT_SECRET`.

> **Heads-up.** The shared secret is shown **once**. Copy it into
> your password manager *before* leaving the page. If you lose it
> you can regenerate it, but every existing OAuth token gets
> invalidated.

## 5 · Configure the OAuth redirect URI

On the same page, find the **OAuth Redirect URIs** section. Etsy will
reject any callback to a URI not listed here, byte-for-byte.

Add:

- For local dev: `http://localhost:3000/api/etsy/oauth/callback`
- For production: `https://<your-admin-domain>/api/etsy/oauth/callback`
  — add this whenever the VPS hostname is known; only the local one
  is needed to develop.

Save.

## 6 · Paste the env vars

Open `.env.local` at the repo root (create it from `.env.example` if
this is your first time). Fill in:

```
ETSY_CLIENT_ID=<keystring from step 4>
ETSY_CLIENT_SECRET=<shared secret from step 4>
ETSY_REDIRECT_URI=http://localhost:3000/api/etsy/oauth/callback
```

`ETSY_SHOP_ID` stays blank for now — the admin's first OAuth connect
will fetch your shop ID from Etsy and display it on the settings
page, and you can paste it in then. It's optional at boot.

> **Heads-up — `ETSY_REDIRECT_URI` must match exactly.** Scheme,
> host, port, and path all have to match one of the URIs you
> registered in step 5. `http` vs `https`, a trailing slash, a
> different port — any mismatch and Etsy rejects the callback with
> `redirect_uri_mismatch`.

## 7 · Restart `pnpm dev`

`config.ts` parses the env once at boot, so the new values only take
effect after a restart. If you've forgotten one or mistyped a URL,
the dev server crashes immediately with a readable error listing
every problem — fix and re-run.

## What's next

Once the three vars are set, the rest of Phase 4a is testable
end-to-end:

1. Visit `/settings/etsy` (the admin's Etsy settings page — built in
   the next deliverable).
2. Click **"Conectar con Etsy"** → bounce through Etsy's OAuth
   consent page.
3. Land back on `/settings/etsy` showing **"Conectado como: <your
   shop name>"**.

That's the smoke test. If it works, OAuth + token storage + the
authenticated client are all good.

## Scopes the admin requests

You don't pick scopes at app-creation time on Etsy — they're
requested per-OAuth-flow via the authorize URL. For reference, this
admin requests:

| Scope | Why |
| --- | --- |
| `listings_w` | Create, update, and publish listings |
| `listings_r` | Read listing status + view counts |
| `transactions_r` | Read receipts (the sold-sync poller in Phase 7) |
| `shops_r` | Read shop info (name, currency, shipping profiles) |

If a future phase needs another scope, you re-authorize once — the
admin detects a scope mismatch on the stored token and prompts
"reconnect Etsy".

## Resources

- Etsy quickstart: <https://developers.etsy.com/documentation/tutorials/quickstart/>
- OAuth 2.0 + PKCE reference: <https://developers.etsy.com/documentation/essentials/authentication>
- Rate limits: <https://developers.etsy.com/documentation/essentials/rate-limits>
