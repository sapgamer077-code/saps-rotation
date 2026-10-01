# Rotation

A closet app anyone can use: daily fits from what you own, a next-buys list that learns from your pins, and a brand atlas built around your own styles. It runs in the browser, installs to your home screen, and works offline.

## How it works for each person

- **Their own account.** Everyone signs up with an email and password. Each account can only see its own closet, pins, photos, lists and brands (row-level security plus a private photo folder per account).
- **Style quiz on first sign-in.** Name, menswear/womenswear/both, 1–4 styles from 11, budget, sizes and the pieces they want more of. Editable any time under *You & settings → Your style*.
- **Their own brand atlas.** Built from a shared catalog of about 3,900 brands from around 80 countries, filtered to their styles, audience and budget, with a *Based in* region filter. They can mark Own / Want, hide brands, and add their own.
- **Optional Gemini.** With a free Gemini key, *Personalize with Gemini* adds brands picked just for them (including ones outside the catalog), and Next buys, inspo reading and photo tagging turn on.
- **Measurements & sizes.** In *You*, chest, waist, hips, inseam and shoe size become sizes in US, UK, EU, Japanese and Korean sizing. *Sizes that fit you* records brands they own and how they fit, and Next buys uses both.
- **Trending.** Optional collectors (see `COLLECTORS.md`) count brand mentions on fashion blogs and newsletters and track Instagram follower growth, shown to everyone under *Brands → Trending this week*.
- **Wear tracking.** "Wore this" on any fit or piece logs it. The closet shows wear counts, cost per wear and what's been sitting longest, and the fit maker rotates toward idle pieces.
- **Swipe deck.** Real products from links people paste (read like a link preview). Likes count like pins in Next buys. Setup in `COLLECTORS.md`.
- **Trip packing.** City, dates and plans become one outfit per day and a packing list, from the forecast (or last year's weather if it's too far out).
- **ROT.** Tap ROT to chat. With Gemini it answers anything about your clothes and can save fits, log wears, add wants and mark the wash when you tap to confirm.
- **ROT in your pic.** Drop ROT into a real fit photo in one of 13 poses (looming, arms crossed, punch, kick, handstand…), placed behind you with a dithered aura (your cut-out runs on the phone). With Gemini, ROT can rate the fit.
- **On-body shots.** With Gemini, the fit maker looks at up to 10 of your on-body photos to judge how each piece actually sits.
- **Share a fit.** Makes an image card of the fit for the share sheet.
- **Next buys.** Without AI it ranks pieces from their styles by tagged pins (newer pins count more), their want-more-of list, their budget and what their closet unlocks. With Gemini it builds the list from their pins and closet.

## Supabase settings for a shared app

1. **SQL Editor:** run the setup code (shown in the app's first-run setup, and in `platform.js`).
2. **Authentication → Sign In / Providers:** keep **Allow new users to sign up** on.
3. **Confirm email:** on is safer. If on, set **Authentication → URL Configuration → Site URL** to the app's address so the email link opens the app.
4. Everyone shares the free plan: 500 MB database, 1 GB photos (roughly 3,000 photos), and the project pauses after a week with no use.
5. As the project owner you can see every account's data in the Supabase dashboard. Tell people that.

## Files

- `index.html`, `app.js` — the app
- `catalog.js` — style library, wardrobe pieces, the shared brand catalog and country/region tables
- `size.js` — size charts and conversions
- `brandmatch.json` — how the collectors recognize each brand in post titles
- `supabase/` — collector tables, the `collect` and `product` Edge Functions and the schedule (setup in `COLLECTORS.md`)
- `platform.js` — on-device storage, Supabase sync and accounts, photo storage, optional Gemini
- `config.js` — the Supabase project URL and publishable key (public by design)
- `sw.js`, `manifest.webmanifest`, `*.png` — offline support and home-screen install
- `supabase.js` — supabase-js 2.117.2, bundled so the app works offline

To release an update, change `VERSION` in `sw.js` so phones pick up the new files.
