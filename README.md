# Token Radar — radar-2

A token launch radar for make.fun's token-radar-01 bounty ($1,325; 1st $1,000).
It reads DefiLlama's sealed protocol snapshot, ranks the protocols that record
no token by an implied value, and shows a reader how to farm each one.

## What it is

- **Board**: 178 pre-token protocols ranked by implied value — all 40 of the
  snapshot's watchlist plus 138 launch candidates below the $50M floor.
- **Model (radar-2)**: `implied = TVL x 0.25 x growth x maturity x breadth`
  - `growth = 1 + 0.5 x sign(g) x sqrt(|g| / 100)`, with `g` the seven-day
    change clamped to [-50, +150]%. The curve is concave on purpose: this
    snapshot's weekly changes run from -73% to +4,448%, so a linear clamp
    would score a 40x week the same as a doubling. The square root keeps the
    order while treating an extreme week as mostly noise.
  - `maturity = 0.6 + 0.4 x min(age_days, 1095) / 1095` — how long the
    protocol has run with no token (unknown age: 365 days).
  - `breadth = 1 + 0.05 x min(chains - 1, 4)` — protocols live on several
    chains reach a wider user base.
  - No protocol name is special-cased; one function scores every row.
- **Launch candidates only**: a ranked row must record no token AND not be a
  wrapped, staked or bridged product, an exchange, or a versioned pool — the
  watchlist's own exclusion rule, applied to the whole board. (The starter
  ranks 48 wrapped/staked/bridge products below the floor; this board ranks
  none of them.) A protocol here *records* no token; that is DefiLlama's
  record, never proof it has none.
- **Farm plans**: six steps per protocol, derived from its category, chains,
  TVL and age — a category-specific main action and weekly action, each with
  its cost and time. Live-token protocols are set aside with their market
  caps shown, never mixed into the ranking.
- **Dashboard**: a static dark-theme page (no network, no framework) with a
  sortable board, search, category and chain filters, a pre-token / live-token
  switch, and a detail drawer per protocol that recomputes the model live and
  shows the farm plan.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

`main.ts` (Node 22, standard library only) writes `board.json`, `data.js`,
`dashboard/`, `screenshots/` and `dossier.json` into the output directory.
It is deterministic: two runs on the same snapshot write identical bytes.

## Layout

- `main.ts` — the program: snapshot in, board + dashboard + dossier out.
- `lib/model.ts` — the radar-2 model, the board builder and the farm plans.
- `vendor/makefun-board.ts` — the kit's dossier library (byte-for-byte copy).
- `dashboard/` — `index.html`, `app.css`, `app.js` (34,483 bytes in all).
- `screenshots/` — `1-board.png` (board), `2-detail.png` (protocol detail),
  `3-filtered.png` (filtered by category), all 1440x900.
- `LICENSE` (MIT), `README.md`, `.makefun/owner.json`.

## Verified locally (cycle 1)

- `main.ts` runs twice, outputs byte-identical; runtime under 1 second.
- All 7 gate checks pass (local mirror in the build notes): dashboard files,
  board file (178 rows), sorted by value, 40/40 watchlist coverage, farm
  steps (6 per row, 20–600 chars), 3 screenshots (1440x900, 150–214 KB),
  dossier matches the rebuilt bytes (725,512 bytes).
- All 178 implied values and multipliers match an independent recomputation
  from the snapshot (0 mismatches).
- The dashboard's farm steps match `board.json` exactly on 5 spot-checked
  categories (Onchain Capital Allocator, CDP, RWA, Dexs, Collateral Markets).
- Screenshots taken with headless Chromium (Puppeteer, local files only).

## Next cycles

- Judge-facing polish: compare against the starter (house dashboard 2) on
  readability, and tighten the farm plans where the weekly action repeats.
- Dev-heat feedback after the first submission: the dev grade judges the
  entry against the four fixed house dashboards; use its rate to decide
  whether the model or the page needs the next change.
