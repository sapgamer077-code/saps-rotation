# Brand trends: Reddit, blogs and Instagram

Rotation can watch fashion subreddits, blogs and newsletters for brand mentions, and track Instagram follower growth. The results show up for everyone in **Brands → Trending this week**. It all runs free inside your Supabase project. Nothing scrapes sites against their rules: Reddit and Instagram go through their official APIs, and blogs through their public RSS feeds.

You only set this up once, in your own project. Every user of the app sees the results. Steps 1–4 work fine from a phone; step 5 (Instagram) is easier on a computer.

## 1. Create the tables

Supabase → **SQL Editor** → New query → paste all of `supabase/collectors.sql` → **Run**.

This adds the shared tables, a starter list of 8 fashion feeds (edit them any time in **Table Editor → feeds**), and the `brand_suggestions` table for brands people suggest from the app.

## 2. Make a Reddit app (free)

1. Sign in at reddit.com, then open **reddit.com/prefs/apps**.
2. Tap **create another app**. Name: `rotation-trends`. Type: **script**. Redirect URI: `http://localhost` (it isn't used).
3. Save. Copy the short code under the app name (the **client ID**) and the **secret**.

If Reddit asks you to register for API access, describe it as a personal, non-commercial project that counts brand mentions in public posts.

## 3. Deploy the collector

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it `collect`. Replace the sample code with all of `supabase/functions/collect/index.ts`. Tap **Deploy**.
3. Open the function's **Details** and turn **off** "Verify JWT" (the function checks its own secret instead). Save.
4. **Edge Functions → Secrets**, add:

| Name | Value |
|---|---|
| `CRON_SECRET` | Any long random text. Make one up and keep it somewhere. |
| `APP_URL` | Your app's address, like `https://yourname.github.io/rotation` |
| `REDDIT_CLIENT_ID` | From step 2 |
| `REDDIT_CLIENT_SECRET` | From step 2 |

Never put these in the app's files. They live only in Supabase.

## 4. Turn on the schedule

SQL Editor → paste `supabase/schedule.sql` → replace `PASTE_YOUR_CRON_SECRET` in all 3 places with your `CRON_SECRET` → **Run**.

Reddit runs every 6 hours and blogs twice a day. To check it worked, wait for the next run, or run the last commented line in that file to see the replies. After a day, **Table Editor → brand_mentions** fills up and the Trending section appears in the app.

## 5. Instagram follower growth (optional)

Instagram's API can't read who a brand follows, but it can read the follower count of any **business or creator** account. That's what this uses.

1. Switch your own Instagram to a **professional** account (Settings → Account type) and link it to a Facebook Page.
2. At **developers.facebook.com**, create an app (type **Business**), add **Instagram Graph API**.
3. In **Graph API Explorer**, pick your app, add permissions `instagram_basic`, `pages_show_list`, `pages_read_engagement`, `business_management`, and generate a token.
4. Run `me/accounts?fields=instagram_business_account` and copy the `instagram_business_account` id. That's `IG_USER_ID`.
5. Swap the token for a long-lived one (Access Token Debugger → **Extend Access Token**). That's `IG_TOKEN`. It lasts about 60 days, so put a reminder in your calendar to extend it again.
6. Add both as Edge Function secrets.
7. **Table Editor → ig_handles**: add a row per brand to track. `brand` must match the name in the app exactly (e.g. `Our Legacy`), `username` is the handle without the @.

It checks up to 150 accounts per run, which stays inside Meta's free limit.

## Brands people suggest

When someone adds a brand in the app that isn't in the list, it lands in **Table Editor → brand_suggestions**. Tick **approved** and fix the details if needed (`cc` is the 2-letter country code). Approved brands show up for every user and the collectors start counting their mentions.
