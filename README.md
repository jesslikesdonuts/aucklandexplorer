# Auckland Explorer

A very simple app for saving and browsing places to eat, drink and visit around Auckland suburbs.

## How it's built

Just three files, no build step, and one small external library:

- `index.html` — the page structure (the form, the filters, the list)
- `style.css` — appearance
- `app.js` — everything the app *does*: reading/saving data, and updating the page
- [Leaflet](https://leafletjs.com/), loaded from a CDN, draws the map. It's a small,
  free mapping library that uses [OpenStreetMap](https://www.openstreetmap.org/)
  for map tiles — no API key, no billing, no signup required (unlike Google Maps).
- Address/place search uses OpenStreetMap's free
  [Nominatim](https://nominatim.org/) search service — also no API key needed.

There's no server and no database. Your places are saved with the browser's built-in
`localStorage`, which is a small key-value store every browser provides. This means:

- Your data survives closing the tab and refreshing the page.
- It's tied to **one browser on one device**. Opening the app in a different browser,
  or in incognito/private mode, or on your phone, will not show the same list.
- Clearing your browser's site data/cookies for this page will erase it.

That's a fine tradeoff for a personal v1 tool. If you outgrow it later, the natural
next step is a small backend (e.g. a free database like Supabase or Firebase) — but
that's genuinely not needed yet.

One thing that does need the internet: the map view loads its map images (tiles) from
OpenStreetMap and the Leaflet library from a CDN, so you'll need an internet connection
for the map to appear. The rest of the app (adding, filtering, everything else) works
fully offline.

## Running it locally

Since there's no build step, you have two options:

**Option 1 — just open the file**
Double-click `index.html` (or open it via your browser's File > Open menu).
This works fine for this app.

**Option 2 — run a tiny local server** (slightly more "correct", occasionally needed
if a browser is fussy about local files)
From this folder, run one of:

```bash
python3 -m http.server 8000
# then open http://localhost:8000

# or, if you have Node installed:
npx serve
```

## Using the app

- Fill in the "Add a new place" form (name, suburb, category, optional notes) and
  click **Add place**.
- Suburbs aren't a fixed list you manage separately — they're just whatever you type
  in the Suburb field. As you add places, the Suburb filter dropdown fills in
  automatically with the suburbs you've used, and you'll get autocomplete suggestions
  when typing.
- Categories are fixed (Breakfast/Brunch, Coffee, Bakery, Lunch, Dinner, Bar,
  Activities), but a place can have more than one — tick as many as apply in the
  Category dropdown. Filtering by a category matches any place that has it, even if
  it also has others.
- Use the Suburb and Category dropdowns under "Browse places" to filter the list, and
  the Sort by dropdown to order it — by Suburb, Name, Category, or Newest first (most
  recently added first).
- Each place has a **Delete** button if you want to remove it.
- When adding a place, you can optionally type a street or place name into the search
  box above the map and pick a result to jump the map there and drop a pin — or just
  click the map yourself if you'd rather. This is optional — a place without a pin
  still saves and shows up in the list, it just won't appear on the map.
- Each place also has a **📍 Set location** / **📍 Update location** button, so you
  can add or move a pin after the fact (including for the pre-loaded example places).
- Click **Map** (next to **List**, above the places) to see a map with a pin for every
  place that has one, respecting whatever suburb/category filters are active. Click a
  pin to see that place's details. Pins are colored by category (a place with more
  than one category is colored by the first one), with a small legend shown above
  the map.

The app comes pre-loaded with a handful of example places the first time you open it,
just so the list isn't empty. Their map pins are approximate. Delete them whenever you
like — they won't come back.

## Deploying to Netlify

Because this is a plain static site, deployment is simple. Two ways to do it:

**Option A — drag and drop (fastest, no git needed)**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag this whole project folder onto the page.
3. Netlify gives you a live URL immediately.

**Option B — connect this GitHub repo (better if you'll keep updating the app)**
1. In Netlify, click **Add new site > Import an existing project**.
2. Pick this repository.
3. Build settings: leave the **build command** empty and set the **publish directory**
   to `.` (the repo root). The included `netlify.toml` already sets this for you.
4. Deploy. Every time you push changes to this branch, Netlify redeploys automatically.

One thing worth knowing: since data lives in each visitor's own browser
(`localStorage`), everyone who opens your deployed site gets their *own* independent,
empty-until-they-add-something list. There's no shared/central data — that's expected
for this version.
