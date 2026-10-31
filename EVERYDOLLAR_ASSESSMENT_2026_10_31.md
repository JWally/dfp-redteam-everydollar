# EveryDollar (Dave Ramsey) — security stack assessment (2026-10-31)

**Subject:** the protection + tracking stack on everydollar.com / Ramsey
Solutions (the budgeting app).
**Method:** public-site analysis + browser observation of the unauthenticated
login flow. No account data.

> **TL;DR — no dedicated DFP/anti-bot vendor.** EveryDollar's security is
> **Auth0 Universal Login + reCAPTCHA v2** (which Auth0 embeds), plus
> Datadog/Sentry monitoring and Segment/Mixpanel analytics + rrweb session
> replay on the app. The "fingerprint" markers in the bundles are rrweb replay
> + Mixpanel device_id, not a fraud SDK. The user-facing gate is reCAPTCHA at
> login; the app itself is Auth0-token-gated.

---

## 1. The stack

| Layer | Product | Evidence |
|---|---|---|
| **Auth** | **Auth0 (Universal Login)** | `app.everydollar.com/oauth2/authorization/auth0` → `id.ramseysolutions.com/authorize` (client `kidx6B6kIervhsCKFlP0foAb4mIQ28Es`, scope email/offline_access/openid/profile) → `u/login/identifier` |
| **Anti-bot at login** | **reCAPTCHA v2** (Auth0-embedded) | `recaptcha.net/anchored?k=6LdxSscbAAAAAFBBnuQrtgdKy7vw8FTT8YJZQzZh` on id.ramseysolutions.com; `recaptcha.net/api.js?render=explicit` |
| **Monitoring** | Datadog + Sentry | `DD` (ddforward/application.id/browser-intake), Sentry DSN |
| **Analytics** | Segment + Optimizely + Mixpanel + Meta/Pinterest/LinkedIn/Nextdoor pixels | `cdn.segment.com`, `cdn.optimizely.com`, gtm.ramseysolutions.com |
| **Session replay** | **rrweb** | canvas/webgl/getContext + rr_dataURL hooks in the app bundle |
| **App API** | Auth0 JWT + CSRF | `X-CSRF-TOKEN`, 401 → `/app/oauth2/authorization/auth0` |
| **Edge** | CloudFront + Apache | `via: CloudFront`, `server: Apache` |

## 2. What the "fingerprint" markers actually are (no DFP vendor)

- `fingerprint` in bundles → **Auth0/Sentry** error context + **rrweb** element fingerprints, NOT a device-fraud hash.
- `device_id` → **Mixpanel's** anonymous device id (`$device_id`, distinct_id).
- canvas/webgl/`getContext` → **rrweb session replay** (recording DOM/canvas for support/UX), which by-design touches the same signals a DFP would.
- `evs.apex.everydollar.com` → **Segment analytics CDN** (`cdnURL: https://evs.apex.everydollar.com`), not a risk service.

So there is **no Forter/Sift/Kasada/device-intel** to red-team — the anti-bot surface is Auth0's hosted login + reCAPTCHA.

## 3. The reCAPTCHA

- **v2** (sitekey `6LdxSscbAAAAAFBBnuQrtgdKy7vw8FTT8YJZQzZh`), loaded explicitly on the Auth0 domain (`render=explicit&onload=captchaCallback`).
- This is the classic "human checkbox" gate on login — server-verified by Auth0/Google, per-request.
- Same class as every reCAPTCHA-v2 deployment: bypassable by solver/clean-browser, but server-verified.

## 4. What this means

- **EveryDollar invested in Auth0's hosted login (with reCAPTCHA) rather than a bespoke device SDK.** The actual fraud/DTO (new-account abuse, promos) defense is: reCAPTCHA at signup/login + the Auth0 transaction + server-side API checks.
- The deepest client tracking is **rrweb** (full session replay) — privacy-relevant, but not a security boundary.
- Auth0 Universal Login is server-side; the client can't mint a session token.

## 5. Honest boundaries

- We observed the login flow + reCAPTCHA; did NOT submit credentials, solve reCAPTCHA, or obtain a session.
- rrweb/Segment/Mixpanel are analytics/replay, not DFP — a separate privacy discussion, not a "defeat the device proof" one.

## 6. Artifacts

| File | What |
|---|---|
| `scripts/ed-probe.mjs`, `ed-login.mjs`, `ed-app.mjs` | capture probes |
| `artifacts/probe1.json`, `app-flow.json`, `auth0-flow.json`, `rc-capture.json` | request/flow captures |
| `artifacts/reCAPTCHA-sitekey` | `6LdxSscbAAAAAFBBnuQrtgdKy7vw8FTT8YJZQzZh` |
| `assets/*.js` | app bundles (rrweb, segment, auth0 refs) |

## 7. Summary line

> *"EveryDollar's security is Auth0 Universal Login + reCAPTCHA v2 — no
> dedicated device-fingerprint vendor. The canvas/webgl/device markers in the
> bundles are rrweb session replay and Mixpanel device_id, not fraud SDKs. The
> anti-bot gate is a server-verified reCAPTCHA at login; the app is
> Auth0-token-gated. Clean stack, server-decided, nothing client-mintable."*