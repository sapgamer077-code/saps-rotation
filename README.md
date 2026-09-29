# Rotation

A closet app anyone can use: daily fits from what you own, a next-buys list that learns from your pins, and a brand atlas built around your own styles. It runs in the browser, installs to your home screen, and works offline.

## How it works for each person

- **Their own account.** Everyone signs up with an email and password. Each account can only see its own closet, pins, photos, lists and brands (row-level security plus a private photo folder per account).
- **Style quiz on first sign-in.** Name, menswear/womenswear/both, 1–4 styles from 11, budget, sizes and the pieces they want more of. Editable any time under *You & settings → Your style*.
- **Their own brand atlas.** Built from a shared catalog of 300+ brands, filtered to their styles, audience and budget. They can mark Own / Want, hide brands, and add their own.
- **Optional Gemini.** With a free Gemini key, *Personalize with Gemini* adds brands picked just for them (including ones outside the catalog), and Next buys, inspo reading and photo tagging turn on.
- **Next buys.** Without AI it ranks pieces from their styles by tagged pins (newer pins count more), their want-more-of list, their budget and what their closet unlocks. With Gemini it builds the list from their pins and closet.

## Supabase settings for a shared app

1. **SQL Editor:** run the setup code (shown in the app's first-run setup, and in `platform.js`).
2. **Authentication → Sign In / Providers:** keep **Allow new users to sign up** on.
3. **Confirm email:** on is safer. If on, set **Authentication → URL Configuration → Site URL** to the app's address so the email link opens the app.
4. Everyone shares the free plan: 500 MB database, 1 GB photos (roughly 3,000 photos), and the project pauses after a week with no use.
5. As the project owner you can see every account's data in the Supabase dashboard. Tell people that.

## Files

- `index.html`, `app.js` — the app
- `catalog.js` — style library, wardrobe pieces and the shared brand catalog
- `platform.js` — on-device storage, Supabase sync and accounts, photo storage, optional Gemini
- `config.js` — the Supabase project URL and publishable key (public by design)
- `sw.js`, `manifest.webmanifest`, `*.png` — offline support and home-screen install
- `supabase.js`, `three.min.js` — supabase-js 2.117.2 and three.js r128, bundled so the app works offline

To release an update, change `VERSION` in `sw.js` so phones pick up the new files.
