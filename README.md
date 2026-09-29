# Sap's Rotation

A personal closet app: daily fits from what you own, a next-buys list that learns from your pins, and a three-style brand guide (grisch, streetwear, cozy). It runs in the browser, installs to your home screen, and works offline.

## What it runs on (all free)

- **Hosting:** GitHub Pages.
- **Sync:** your own Supabase project (free plan). Your closet, pins and photos are private to your account through row-level security and a private storage bucket.
- **Smart features (optional):** a Google Gemini API key, pasted in *You & settings*. Without a key, the built-in stylist and the rule-based next-buys list run instead.

## First-time setup

1. Open the site. Choose **Set up sync**.
2. In Supabase: **SQL Editor** → paste the setup code the app shows → **Run**.
3. In Supabase: **Project Settings → API** → copy the **Project URL** and the **publishable (anon) key** into the app.
4. Create your account in the app (email + password).
5. In Supabase: **Authentication → Sign In / Providers** → turn off **Allow new users to sign up** so nobody else can use your project.
6. In the app: **You & settings → Restore from backup** → pick `saps-rotation-backup.json` to bring over your closet from Claude.

On every other device, open the site and sign in with the same email and password.

## Good to know

- Free Supabase projects pause after a week with no use. If sync stops after a break, open the project at supabase.com and press **Restore**. Your phone keeps working offline in the meantime.
- **Download backup** in settings saves everything (including photos) as one file.
- On Google's free Gemini tier, what you send (including photos) can be used to improve Google's products.

## Files

- `index.html`, `app.js` — the app
- `platform.js` — on-device storage, Supabase sync, photo storage, optional Gemini
- `sw.js`, `manifest.webmanifest`, `*.png` — offline support and home-screen install
- `supabase.js`, `three.min.js` — supabase-js 2.117.2 and three.js r128, bundled so the app works offline

To release an update, change `VERSION` in `sw.js` so phones pick up the new files.
