# Watch Next

A three-screen shared watchlist: add something, get a random pick, rate it once you've watched it.

## Try it right now

No build step, no install. Just open `index.html` in a browser — double-click it, or on
a phone, put the whole `watch-next` folder somewhere like Google Drive/Dropbox and open
the file from there. Everything works immediately.

## Add it to your phone's home screen

1. Host the folder somewhere with a URL (see "Going live" below) — home-screen install
   needs a real `https://` address, it won't work from a local file.
2. Open that URL on your phone.
3. iPhone (Safari): tap the Share icon → **Add to Home Screen**.
   Android (Chrome): tap the **⋮** menu → **Add to Home screen** (or you'll see an
   automatic install prompt).
4. It opens full-screen with its own icon, no browser bar — feels like a real app.

## Going live (free hosting)

Since you've already got a GitHub account from the clan tracker, the fastest path:

1. Create a new GitHub repo (e.g. `watch-next`).
2. Upload all the files in this folder (`index.html`, `style.css`, `app.js`,
   `manifest.json`, the icon PNGs).
3. Repo Settings → Pages → set source to the main branch → save.
4. GitHub gives you a URL like `https://yourname.github.io/watch-next/` — that's your
   live site.

## Important: this version doesn't sync between phones yet

Right now the app saves everything with `localStorage` — data lives only in the
browser that added it. That means:

- It's fully working and usable solo today, on whichever phone you set it up on.
- What you add on your phone won't show up on hers, and vice versa, until it's wired
  up to a shared backend.

**To make it actually shared**, the cleanest low-effort option is a free
[Supabase](https://supabase.com) project (a hosted Postgres database with a simple
JS client) — takes about 10 minutes to set up:

1. Create a free Supabase project.
2. Add one table (`watchlist`) with columns: `id`, `title`, `type`, `genre`, `status`,
   `rating`.
3. Send me the project URL and anon key and I'll swap the storage layer in `app.js`
   over to Supabase — the rest of the app (screens, styling, interactions) stays
   exactly the same.

Alternatively, since you've already built the Google Sheets + Apps Script pipeline for
the clan tracker, the same pattern works here too — a bit more setup than Supabase, but
zero new tools to learn.

## Files

- `index.html` — page structure, all three screens
- `style.css` — the "cinema at night" theme (navy background, gold accent, ticket-stub
  poster cards)
- `app.js` — all the logic: add, remove, random pick, star rating, screen switching
- `manifest.json` + icon PNGs — home-screen install support
