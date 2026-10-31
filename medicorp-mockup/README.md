# Medicorp — brace finder mock-up

Clickable, static mock-up for a placeholder orthopedic brace company ("Medicorp").
Plain HTML/CSS/vanilla JS. No build step, no CDNs, no backend, no real payments, no real PHI.

## Run it

```bash
cd site
python3 -m http.server 8765
# open http://localhost:8765/
```

Serve over HTTP (any static server works). Opening `index.html` straight from disk
usually blocks `fetch()` of the catalog.

## Files

| Path | Purpose |
|---|---|
| `index.html` | Single page: header, hero prompt + mic, results, catalog, product/order, privacy, footer. SEO title/meta. |
| `css/styles.css` | Mobile-first responsive styles. |
| `js/matcher.js` | Pure query parser + scoring (age, sex, height, weight, frame, body area, condition keywords) and size recommendation. Works in browser and Node. |
| `js/app.js` | UI, in-memory state, hash router (product id only), order form, TEST MODE checkout, `startGrokVoice()` hook. |
| `data/catalog.json` | 14 placeholder products. |
| `tests/match.test.js` | `node tests/match.test.js`, matching-logic tests. |
| `tests/dom-flow.test.js` | Optional end-to-end flow test with jsdom (`npm i jsdom` somewhere on `NODE_PATH`). |

## Swapping in a real catalog

Replace `data/catalog.json`. The app accepts either `{ "products": [...] }` or a bare array.
Each product:

```json
{
  "id": "unique-slug",
  "name": "Product name",
  "category": "knee | back | neck | wrist | ankle | shoulder",
  "indications": ["..."],
  "keywords": ["acl", "torn acl", "..."],
  "specs": { "Label": "Value" },
  "sizes": [{ "label": "M", "fit": "Thigh 17-20 in", "heightIn": [63, 69], "weightLb": [135, 180] }],
  "price": 389.00,
  "hcpcs": "L1843 (example)"
}
```

- `keywords` drive scoring (single words +3, multi-word phrases +5). Body-area match adds +10, and products in the wrong area are demoted.
- `heightIn` / `weightLb` ranges drive the recommended size. Weight counts most.
- To add a new category, add it to `AREA_TERMS` in `js/matcher.js` and optionally an icon in `ICONS` in `js/app.js`.

## Voice

The mic button calls `startGrokVoice(handlers)` in `js/app.js` ("Grok voice integration point").
For now it uses the browser Web Speech API and shows a fallback message when that isn't supported.
Replace the function body with a BAA-covered voice service and keep the same callback contract.

## Privacy / HIPAA notes

- Only patient initials or an internal reference number, size, side and quantity are collected.
- Search text and order data stay in memory. The URL only ever contains `#/product/<id>`.
- No console logging, cookies, localStorage or sessionStorage.
- Checkout is a Stripe-style placeholder labeled TEST MODE. There are no keys and no network calls. It accepts `4242 4242 4242 4242`.
- Production would need HTTPS, BAAs, encryption at rest and access logging. These are listed as placeholders in the in-app Privacy & HIPAA panel.

## Production costs / HIPAA (notes from Chief, 2026-10-31; verify before quoting)

- Voice: keep it one-way speech-to-text (browser speech API in the mock-up). Production option: OpenAI gpt-4o-mini-transcribe, about $0.003/min. No two-way Realtime voice.
- Catalog: bundled as static JSON (`data/catalog.json`). Don't use a free Supabase project; free projects pause after 7 idle days.
- Hosting: not Vercel Hobby (non-commercial only). Vercel Pro + BAA is about $370/mo.
- Database (if needed later): Supabase Team $599+/mo plus a HIPAA add-on.
- OpenAI BAA: requested through the OpenAI org settings.
- Mock-up uses fake data only, so no BAA-covered services are needed for it.
