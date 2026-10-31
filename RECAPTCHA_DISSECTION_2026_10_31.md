# reCAPTCHA v2 — how it secures itself + get-through attempt (2026-10-31)

**Subject:** the reCAPTCHA v2 instance on EveryDollar/Auth0's login
(`id.ramseysolutions.com`) — engine dissection + challenge-capture attempt.
**Method:** captured the full engine (`recaptcha__en.js`, 829 KB) + live
widget flows (anchor/bframe) on the site's sitekey
(`6LdxSscbAAAAAFBBnuQrtgdKy7vw8FTT8YJZQzZh`); read-only interaction. No
credentials, nothing forwarded.

> **TL;DR — reCAPTCHA v2 defends with the CHALLENGE + interaction signals,
> not a client fingerprint.** Its engine collects far less than the DFP
> vendors (no webdriver/webgl/audio checks): navigator, canvas, screen,
> performance, visibility, and an explicit **iframe-detection check**. The
> gate is server-side scoring of the click's interaction quality + the image
> challenge. We dissected the engine and rendered the widget, but did NOT
> obtain a solved token — the checkbox rejected our automated clicks (the
> behavioral wall, same class as hCaptcha's human checks).

---

## 1. The engine's signal surface (what reCAPTCHA looks at)

From `recaptcha__en.js` (829 KB, v bSuJ2xBC8cHT21):

| Signal | Count | Purpose |
|---|---|---|
| `navigator` | 18 | UA/platform/API availability |
| `canvas` | 21 | challenge canvas render; minimal fingerprint use |
| `screen` | 19 | viewport/dimensions |
| `performance` | 14 | timing (keystroke/click latencies) |
| `visibility` | 16 | page visibility state |
| `frame`/`parent`/`top` | 14/21/60 | **frame-integrity** (below) |
| `platform`, `deviceMemory`, `localStorage` | a few | environment basics |

**Notably absent:** NO `webdriver` check, NO WebGL, NO audio, NO fonts, NO
WebRTC. reCAPTCHA v2 does **not** do a device-fingerprint collection the way
the DFP vendors do — its model is different.

## 2. The explicit iframe-detection check

```js
A().parent != A() ? true : A().frameElement != null
```
- Flags if the widget's page is **not top-level** (framed/embedded) or has a
  `frameElement` — i.e., the widget must live in a clean top-level page.
- This is one of the few *structural* checks in the engine.

## 3. The challenge flow (endpoints + how it works)

```
reCAPTCHA widget → api2/anchor (checkbox iframe) → api2/bframe (challenge iframe)
   click checkbox → api2/reload (get challenge) OR passive pass (no challenge)
   solve image → api2/userverify (submit proof) → g-recaptcha-response token
   verify token server-side (auditing/g-recaptcha-response → /siteverify)
```

- The `reload` POST returns the **challenge JSON** (image + instructions);
  `userverify` returns the **token**.
- The checkbox can pass *without* a challenge if the interaction signals
  (mouse path, timing, focus, visibility) look human (the "interactive
  challenge" z-score model) — this is the part bots try to satisfy with
  human-like input.

## 4. The get-through attempt (honest result)

| Attempt | Result |
|---|---|
| headless checkbox click | iframe not renderable / no click registered |
| clean-Chrome headed, human-ish mouse path + click | checkbox rendered, **no token, no reload fired** — interaction not accepted |
| direct `/u/login/password` URL | Auth0 state-token check bounced us back to identifier |

- **No solved token obtained.** The checkbox's interaction scoring rejected
  our automated-but-smooth clicks. Getting a token requires either:
  (a) genuinely human interaction (real mouse, real user, real timing), or
  (b) solving the image challenge (the ML/CV problem), or
  (c) a solver service — all outside client-code exploitation.

## 5. What this teaches (vs the rest of the project)

| Vendor | Client fingerprint | Client can mint proof? |
|---|---|---|
| reCAPTCHA v2 | **minimal** (no webdriver/webgl/audio) | **No** — token from server challenge/interaction scoring |
| Kasada | VM + PoW + fingerprint | `cd` presence-checked (we bypassed it) |
| Forter | CFG-flattened sensor, encrypted blob | No (token encrypted) |
| Stytch/Castle/etc. | full fingerprint | Yes (all cracked) |

**reCAPTCHA's trick:** it doesn't try to *fingerprint* the device — it
scores the **interaction** and gates with an **image challenge**. That's why
there's no payload to read/tamper: the "payload" (token) only exists after
the server accepts the interaction/challenge. It's the same philosophical
design as hCaptcha/Kraken-PoW (server-issued proof) — with the interaction
scoring as the moat instead of a VM.

## 6. Honest boundaries

- Engine dissected; widget rendered; **no token solved** (interaction wall +
  image-challenge ML required — not attempted).
- No credentials submitted; token verification (`/siteverify`) untouched.

## 7. Artifacts

| File | What |
|---|---|
| `assets/recaptcha__en.js` | the 829 KB engine (saved from gstatic) |
| `scripts/rc-harness.mjs`, `rc-capture*.mjs`, `rc-challenge.mjs`, `rc-solve-attempt.mjs` | capture/interaction probes |
| `artifacts/rc-harness.json`, `rc-attempt.json`, `rc-challenge.json` | flow captures |
| sitekey | `6LdxSscbAAAAAFBBnuQrtgdKy7vw8FTT8YJZQzZh` (Auth0 login) |

## 8. Summary line

> *"reCAPTCHA v2 secures itself with interaction scoring + the image challenge,
> not a device fingerprint: its engine collects minimal environment signals
> (navigator/canvas/screen/timing) plus an explicit iframe-detection check, and
> the token only exists after the server accepts the interaction. Our
> automated clicks were rejected — no token obtained. The moat is behavioral,
> not cryptographic, which is why there's no client payload to read: the proof
> is server-issued."*