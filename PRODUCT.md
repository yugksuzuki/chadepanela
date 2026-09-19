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
- `api/claims.js` is a Vercel serverless function; claims persist in Vercel Blob storage (`claims.json`) via `put`/`list`, read on every request (no caching). It also emails the couple on every claim and unclaim. The provider is whichever is configured, in order: Web3Forms (`WEB3FORMS_KEYS`), direct SMTP (`SMTP_USER`/`SMTP_PASS`, e.g. a Gmail app password), Brevo (`BREVO_API_KEY`), then Resend (`RESEND_API_KEY`); all but Web3Forms share `CLAIM_EMAIL_FROM`/`CLAIM_EMAIL_TO`, since a Web3Forms key already names its own recipient. Web3Forms leads the chain because it is the only one asking nothing of the couple beyond typing an email address: no OAuth consent screen, no app password, no domain, no account. The couple owns no domain, which rules Resend out on its own — it only delivers to the account owner without a verified domain — so the fallback chain exists to keep a no-domain path open rather than to support providers for their own sake. They also have no access to a Google app password, so the primary notification route is a Google Sheet instead: each claim POSTs a row to an Apps Script web app (`SHEETS_WEBHOOK_URL`, optional `SHEETS_WEBHOOK_TOKEN`), and Sheets' own notification rules do the notifying. Its only credential is a URL, which is the point. The record of record is a Supabase table (`public.escolhas` in project `pjcuruezxmukopwzqxks`), written with a publishable key whose RLS policy grants INSERT and nothing else, so a leaked key can only add noise — not read who chose what, nor delete, nor alter. Email, sheet and Supabase are independent channels — one failing must not stop the others, and none may fail a claim. Supabase is the record, not the notifier: it sends no email on its own. Email is strictly best-effort: a missing config or a Resend error is logged and swallowed, never surfaced to the guest, because a claim that was persisted must not look like a failure.
- No authentication anywhere: any visitor with the link can claim or unclaim any item under any name. This is a **deliberate honor-system trust model** (guests are people the couple knows), not a gap to fix by default.
- Guest name input is free text, trimmed and capped at 60 characters server-side; no other validation.
- Items are grouped into fixed categories with a "Todos" (all) filter, plus a price-range filter, a price sort, and a "hide already claimed" toggle — the price controls hide themselves entirely while no item carries a price; most items carry one or more outbound purchase links (Mercado Livre, Shopee); a few large items ("Itens grandes": sofá, mesa com cadeiras, televisão, máquina de lavar louça) intentionally have no link yet, with copy directing guests to contact the couple directly.

## Brand Commitments

- Couple names "Paloma & Guilherme" are fixed identity, always in that form. The occasion is now "Chá de Casa Nova" (renamed by the couple from "Chá de Panela"); the visual identity stays pinned to the original chá de panela invitation, so the artwork and the event name deliberately no longer match word-for-word. The localStorage key and the repo/Vercel project names still carry "cha-de-panela" on purpose: changing them would drop every guest's local "undo" and break the already-shared link.
- Voice is warm, informal, first-person plural, in Brazilian Portuguese ("a gente", "com carinho") — never a generic registry-platform tone.
- Visual identity is directly pinned to the couple's own printed chá de panela invitation (a real photo they supplied): deep olive green + warm ivory/cream + soft sage, Alex Brush (script, for the couple's names and the event name only) + Cormorant Garamond (headings) + Lora (body/UI), a recurring heart glyph as the structural-division mark, hand-drawn botanical line art, and a thin corner-bracket frame on the hero. Full detail lives in `DESIGN.md` once written and in `.impeccable/surfaces/src-index-html.md`'s direction contract. This supersedes the previous Playfair Display + Inter pairing.
- Claimed items lean into the brand's own olive-green rather than a generic forest green, so the "claimed" state reads as part of the same world rather than a bolted-on status color.

## Evidence on Hand

Real, curated item list with real category groupings and real marketplace purchase links, in `src/items.js`. Product photos are scraped from each item's own marketplace listing (`og:image`) by `scripts/atualiza-catalogo.mjs` and stored in `src/assets/products/`; the same script fills `price`/`precoEm`. Prices are therefore real-but-dated, never estimated — an item with no `price` renders "Ver preço no link" rather than a guess (currently only `medidor`, a Shopee listing whose price isn't in the static page an automated fetch sees).

All 62 items carry an image. The four "itens grandes" (sofá, mesa com cadeiras, televisão, máquina de lavar louça) have no purchase link by design — copy directs guests to talk to the couple directly — so instead of a photo they carry a hand-authored line-art icon in the site's own visual language, clearly a placeholder rather than a real product shot. Every other item's photo comes from its own real marketplace listing.

Four links were dead, wrong, or inaccessible and were replaced with a real, verified Amazon.com.br listing of the same kind of item (photo, price, and purchase link all updated together, so nothing shows a photo that doesn't match where "Ver produto" leads): `ferro-de-passar` and `porta-temperos`'s original meli.la links had both rotted to a generic recommendations page; `bows-mesa`'s only link pointed at the same listing as `taça de água` (wine glasses, not bowls — a data mistake in the original list, not a scrape error); `talheres-de-servir`'s Shopee link sits behind a login wall. These four are the couple's to swap for their own preferred pick if they want a different specific product — the substitutions are real, live listings, not placeholders, but they weren't chosen by the couple. `lixeiras` (added by the couple, see below) hit the same login wall on Shopee and got the same Amazon-substitute treatment for its photo only — its actual purchase link is still the couple's own Shopee pick.

Five items were added directly by the couple on 2026-09-17, each with its own real link: `pano-de-prato` and `lixeiras` (Shopee, both login-walled — no price shown, "Ver preço no link"), `assadeiras`, `tabua-de-passar-roupa`, and `mop` (Mercado Livre, price and photo fetched normally). `jarra-de-suco` was also replaced outright with the couple's own new Shopee link, dropping the earlier substitute Amazon link and price — its Shopee listing is also login-walled, so it shows "Ver preço no link" until the couple or a logged-in visitor checks the price directly. `cafeteira` gained a second purchase option (`Opção 2`) from the couple rather than being replaced; the card's photo/price still reflect `Opção 1`, consistent with how every other multi-option item in this list already works.

A few items still share a marketplace link from the original list (e.g. `prato-de-sobremesa` and `prato-fundo` both use the same first link) and so share a photo — this is original list data, not a fetch defect, but it hasn't been individually verified item by item: `prato-fundo` ("prato fundo" = deep/soup plate) currently shows a flat plate photo from that shared listing, which may only be approximately right if the listing sells the pattern's flat and deep plates together. Worth a human glance if it matters which exact piece a guest sees.

- A single delivery address (`ENDERECO_ENTREGA` in `src/script.js`) is shown in a dedicated section above the footer and inside a card the moment its guest claims it, each with a copy button that falls back to selecting the text where the clipboard API is unavailable. Remote guests ordering online are a first-class case, so the address has to be reachable at the moment of claiming, not hunted for.

## Product Principles

1. Prevent duplicate gifts — claim state must always be visible and trustworthy to whoever's looking.
2. Work equally well for party attendees and remote guests who never see the couple in person.
3. No accounts, no login friction — the honor-system claim flow (name only) is intentional and should be preserved, not "fixed."
4. Stay personal: the couple's own warm, informal Brazilian Portuguese voice, never generic registry-site copy.

## Accessibility & Inclusion

Audience spans a wide age range including less tech-savvy relatives, mostly on mobile — no further specific requirement beyond designing for that range (clear tap targets, plain language, no assumed technical fluency). Existing `aria-live` progress announcement and `aria-pressed` category nav are already in place and should be preserved.
