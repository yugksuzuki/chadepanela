# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Guests invited to Paloma & Guilherme's chá de panela (a Brazilian pre-wedding/housewarming shower). A mixed-age, Brazilian Portuguese-speaking audience, primarily on mobile phones, spanning tech-savvy friends to less digitally fluent relatives. The site serves two overlapping situations: guests browsing before or during the in-person party, and remote guests who won't attend but still want to pick and send a gift — the site must work as a self-contained registry for the latter, not just a pre-party checklist.

## Product Purpose

A gift registry so guests can browse the couple's requested household items, claim the ones they plan to give, and see at a glance what's already been claimed — preventing duplicate gifts. Success is a guest finding an item, marking it as theirs in a few taps, and trusting that the list reflects reality for everyone else too.

## Positioning

A personal list curated item-by-item by the couple themselves (with real purchase links they picked), not a generic third-party registry platform — the tone, item selection, and even the gaps (a few big items intentionally have no link yet) are theirs, not a template's.

## Operating Context

Shared as a link (e.g. via WhatsApp) before and during the event. Guests claim an item by typing their name — no account or login. The claiming browser remembers its own claims locally (localStorage) to offer an "undo" (unclaim) action; claim state itself is shared server-side so every guest sees the current state regardless of device.

## Capabilities and Constraints

- Static site (plain HTML/CSS/JS, no build step, no framework), deployed on Vercel. Deployment Protection must stay off: with it on, every `.vercel.app` domain — production included — gates the list behind a Vercel login, which is fatal for a link shared on WhatsApp.
- `api/claims.js` is a Vercel serverless function; claims persist in Vercel Blob storage (`claims.json`) via `put`/`list`, read on every request (no caching).
- No authentication anywhere: any visitor with the link can claim or unclaim any item under any name. This is a **deliberate honor-system trust model** (guests are people the couple knows), not a gap to fix by default.
- Guest name input is free text, trimmed and capped at 60 characters server-side; no other validation.
- Items are grouped into fixed categories with a "Todos" (all) filter, plus a price-range filter, a price sort, and a "hide already claimed" toggle — the price controls hide themselves entirely while no item carries a price; most items carry one or more outbound purchase links (Mercado Livre, Shopee); a few large items ("Itens grandes": sofá, mesa com cadeiras, televisão, máquina de lavar louça) intentionally have no link yet, with copy directing guests to contact the couple directly.

## Brand Commitments

- Couple names "Paloma & Guilherme" and the occasion name "Chá de Panela" are fixed identity, always in that form.
- Voice is warm, informal, first-person plural, in Brazilian Portuguese ("a gente", "com carinho") — never a generic registry-platform tone.
- Visual identity is directly pinned to the couple's own printed chá de panela invitation (a real photo they supplied): deep olive green + warm ivory/cream + soft sage, Alex Brush (script, for the couple's names and the event name only) + Cormorant Garamond (headings) + Lora (body/UI), a recurring heart glyph as the structural-division mark, hand-drawn botanical line art, and a thin corner-bracket frame on the hero. Full detail lives in `DESIGN.md` once written and in `.impeccable/surfaces/src-index-html.md`'s direction contract. This supersedes the previous Playfair Display + Inter pairing.
- Claimed items lean into the brand's own olive-green rather than a generic forest green, so the "claimed" state reads as part of the same world rather than a bolted-on status color.

## Evidence on Hand

Real, curated item list with real category groupings and real marketplace purchase links, in `src/items.js`. Product photos are scraped from each item's own marketplace listing (`og:image`) by `scripts/atualiza-catalogo.mjs` and stored in `src/assets/products/`; the same script fills `price`/`precoEm`. Prices are therefore real-but-dated, never estimated — an item with no `price` renders "Ver preço no link" rather than a guess. Known gaps at the time of writing: four photos are wrong because the scrape grabbed the wrong listing's image (ferro de passar and porta temperos both show a mop; jarra de suco shows food containers; bows mesa shows wine glasses), and three pairs of items share a single marketplace link, so they necessarily share a photo. The four "itens grandes" have no purchase link by design (not a missing-data gap) — copy explicitly says to talk to the couple directly for those, and they have no photo for the same reason.

## Product Principles

1. Prevent duplicate gifts — claim state must always be visible and trustworthy to whoever's looking.
2. Work equally well for party attendees and remote guests who never see the couple in person.
3. No accounts, no login friction — the honor-system claim flow (name only) is intentional and should be preserved, not "fixed."
4. Stay personal: the couple's own warm, informal Brazilian Portuguese voice, never generic registry-site copy.

## Accessibility & Inclusion

Audience spans a wide age range including less tech-savvy relatives, mostly on mobile — no further specific requirement beyond designing for that range (clear tap targets, plain language, no assumed technical fluency). Existing `aria-live` progress announcement and `aria-pressed` category nav are already in place and should be preserved.
