# dfp-redteam-everydollar — EveryDollar (Dave Ramsey)

Full details in `EVERYDOLLAR_ASSESSMENT_2026_10_31.md` and
`RECAPTCHA_DISSECTION_2026_10_31.md`.

---

## What we observed

**No dedicated DFP vendor.** The canvas/webgl/device markers in the app
bundles are **rrweb session replay + Mixpanel `$device_id`**, not fraud SDks.
The security stack is:

- **Auth0 Universal Login** (`id.ramseysolutions.com`, client `kidx6B6kIervhsCKFlP0foAb4mIQ28Es`) with **reCAPTCHA v2** (sitekey `6LdxSscbAAAAAFBBnuQrtgdKy7vw8FTT8YJZQzZh`)
- Datadog + Sentry monitoring; Segment/Optimizely/Mixpanel analytics
- CloudFront edge

**No device-proof payload exists client-side** — the Auth0 session is
server-issued, and the anti-bot gate is the server-verified reCAPTCHA.

## The reCAPTCHA dissection (in this repo)

The 829 KB `recaptcha__en.js` engine was dissected: minimal signal surface
(navigator/canvas/screen/timing; **no webdriver/webgl/audio/fonts**), an
explicit iframe-detection check (`parent != self ? true : frameElement !=
null`), and the anchor/bframe/reload/userverify flow mapped. Automated clicks
were **rejected — no token obtained**: the gate is interaction scoring +
image challenge (server-issued proof).

## Status

- ⚪ Read payload: no client payload exists (server-issued Auth0 session)
- 🔴 Tamper with payload: nothing client-side to modify
- 🔴 Mint token: Auth0 session + reCAPTCHA are server-issued

## Files

- writeups: `EVERYDOLLAR_ASSESSMENT_2026_10_31.md`, `RECAPTCHA_DISSECTION_2026_10_31.md`
- `assets/recaptcha__en.js` — the 829 KB engine
- `scripts/rc-*.mjs` — capture/interaction probes
