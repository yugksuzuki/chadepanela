---
name: Chá de Panela — Paloma & Guilherme
description: Olive-and-ivory gift registry pinned to the couple's own printed invitation
colors:
  olive: "#454e2e"
  olive-deep: "#3b4326"
  olive-mid: "#6b7548"
  cream: "#f5efdc"
  ivory: "#faf6ec"
  card: "#fffdf7"
  ink: "#33361f"
  muted: "#5c5c42"
  border: "#e4e0cb"
  sage: "#8b9470"
  sage-soft: "#e7ead6"
  sage-soft-hover: "#dce1c6"
  claimed-bg: "#eef1e1"
  claimed-border: "#c3cba6"
  claimed-text: "#3e5a2a"
typography:
  display-script:
    fontFamily: "'Alex Brush', cursive"
    fontSize: "clamp(3.2rem, 10vw, 5.4rem)"
    fontWeight: 400
    lineHeight: 1
  names-script:
    fontFamily: "'Alex Brush', cursive"
    fontSize: "clamp(1.9rem, 5.5vw, 2.8rem)"
    fontWeight: 400
  headline:
    fontFamily: "'Cormorant Garamond', 'Georgia', serif"
    fontSize: "26px"
    fontWeight: 600
  body:
    fontFamily: "'Lora', 'Georgia', serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "'Lora', 'Georgia', serif"
    fontSize: "13px"
    fontWeight: 600
rounded:
  sm: "9px"
  md: "14px"
  pill: "999px"
spacing:
  card-gap: "16px"
  card-padding: "18px"
  section-gap: "46px"
components:
  claim-btn:
    backgroundColor: "{colors.card}"
    textColor: "{colors.olive}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "44px"
  claim-btn-hover:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.cream}"
    rounded: "{rounded.sm}"
  cat-pill:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "44px"
  cat-pill-active:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.cream}"
    rounded: "{rounded.pill}"
  card-link:
    backgroundColor: "{colors.sage-soft}"
    textColor: "{colors.olive-deep}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "44px"
---

# Design System: Chá de Panela — Paloma & Guilherme

## Overview

**Creative North Star: "The Invitation, Continued"**

This registry is not a registry-platform skin dropped onto the couple's item list — it's the second page of an invitation the couple already printed and handed to their guests. Deep olive and warm ivory carry the same chromatic weight as the paper stock and ink of the reference; a script name treatment, a heart-flanked rule, and a hand-drawn corner-bracket frame are transcribed from a real photo of that invitation, not invented from a mood board. The system is quiet and legible everywhere except the hero, where it allows itself the full ornamental voice of the source material once, then recedes into a calm ivory working surface so 60+ repeated item cards stay scannable on a phone.

This was a full visual replacement, not an extension: the site's prior Playfair Display + Inter, terracotta/cream system is superseded in its entirety. Every ornament in this build is hand-authored inline SVG line art (heart glyph, olive sprig, kitchen mark, brushstroke highlight) — no rasters ship, because no image-generation tool was available in this session; the source-of-truth for provenance is the authored SVG markup itself, matching the reference's own monoline illustration style.

**Key Characteristics:**
- Deep-olive chrome (hero, sticky nav, footer) bracketing a warm-ivory working grid.
- Script (Alex Brush) reserved exclusively for the couple's names and the event name, at hero scale only — never for UI or body text.
- A repeating heart glyph as the one structural-division mark; no kicker/eyebrow labels anywhere, even though the reference invitation itself uses tracked labels above its headlines (craft-floor ban, held anyway).
- Claimed state leans into the brand's own olive/sage family, not a generic forest green.
- Every mark on the page is hand-authored inline SVG (heart, sprig, kitchen line art, brushstroke) — zero shipping rasters.

## Colors

A two-register palette: a deep, saturated olive for chrome/structure, and a warm, pale ivory for the working surface, tied together by a soft sage accent.

### Primary
- **Deep Olive** (`#454e2e`, radial-vignetting toward `#3b4326` at the edges): the hero background, sticky category-nav active state, claim-button outline/hover fill, and footer accents. This is the world's structural color — used for chrome, never for body copy on the ivory surface.
- **Olive Deep** (`#3b4326`): the vignette's outer edge in the hero gradient; also category-title text color on the ivory surface, giving section headers a heavier, chrome-adjacent weight without leaving the ivory register.
- **Olive Mid** (`#6b7548`): the hand-drawn sprig and footer kitchen-mark stroke color — dimmer than structural olive so line art recedes behind text.

### Secondary
- **Soft Sage** (`#8b9470` / tint `#e7ead6`, hover tint `#dce1c6`): the recurring secondary accent — the brushstroke behind "Paloma & Guilherme," the hero progress pill, and every purchase-link chip. Sage is deliberately the brand's own green family, not a foreign accent color.

### Neutral
- **Cream** (`#f5efdc`): hero foreground text and rule color, sitting on the deep-olive chrome.
- **Ivory** (`#faf6ec`): the page's working background — the item-grid surface, chosen so 60+ cards stay calm and scannable rather than competing with the hero.
- **Card** (`#fffdf7`): item-card and pill backgrounds, a half-step brighter than ivory so cards read as distinct surfaces without a shadow doing the work.
- **Ink** (`#33361f`): primary body/UI text color on the ivory surface.
- **Muted** (`#5c5c42`): secondary text (footer line, big-item badge, undo link).
- **Border** (`#e4e0cb`): hairline dividers — card borders, nav underline, category-title rule.

### Claimed state
- **Claimed Background** (`#eef1e1`), **Claimed Border** (`#c3cba6`), **Claimed Text** (`#3e5a2a`): a dedicated olive-family triad for the "already chosen" card and badge state, distinguishing it from the unclaimed card without introducing a foreign status color.

### Named Rules
**The One Script Rule.** Alex Brush appears only on "Chá de Panela" and "Paloma & Guilherme," both in the hero, both at display scale. It never appears in a button, a badge, a category title, or body copy — the script is a name treatment, not a UI typeface.

**The No-Kicker Rule.** No tracked-caps eyebrow/kicker label sits above either script headline, even though the couple's own printed invitation uses one. The heart-flanked rule performs that structural-division job instead. This is a floor-level prohibition, not a system rule to relax later: kickers are a banned device in this world regardless of source-material precedent.

## Typography

**Display Font:** Alex Brush (script; cursive fallback)
**Headline Font:** Cormorant Garamond (with Georgia fallback)
**Body/UI Font:** Lora (with Georgia fallback)

**Character:** A decorative script for two identity moments only, a classic serif for section structure, and a second, more screen-legible serif for everything a guest has to actually read or tap. Lora was deliberately chosen over the invitation's more decorative serif for body/UI because the audience skews older and less tech-fluent, reading on phones — legibility beat decorative fidelity at that layer.

### Hierarchy
- **Display script** (400, `clamp(3.2rem, 10vw, 5.4rem)`, line-height 1): "Chá de Panela" in the hero, once.
- **Names script** (400, `clamp(1.9rem, 5.5vw, 2.8rem)`): "Paloma & Guilherme," set on the sage brushstroke mark inside the hero `<h1>`.
- **Headline** (Cormorant Garamond 600, 26px): category-section titles on the ivory surface, each closed with a `1px` `--border` rule.
- **Body** (Lora 400, 16px, line-height 1.75): the hero welcome message, max-width 480px for measure control.
- **Label** (Lora 600, 13px): claim buttons, card links, category nav pills, claim badges — every interactive control shares this one label voice regardless of component.

### Named Rules
**The Legible-Over-Decorative Rule.** Any text a guest must read to act (item names, claim controls, category labels, the welcome message) is set in Lora, never in the script or the invitation's original decorative serif — screen legibility for a mixed-age, mobile-first audience outranks matching the reference's every letterform.

## Layout

Single-column, content-centered layout with two width containers: the hero inner content is capped at 640px, and the sticky nav + main grid are capped at 960px, both centered with `margin: 0 auto`. The item grid is `repeat(auto-fill, minmax(220px, 1fr))` with a 16px gap, so card count per row is fluid rather than breakpoint-stepped. Category sections stack with 46px of bottom margin between them. The category nav is `position: sticky; top: 0` with an ivory background and a 1px border-bottom, so it stays reachable while scrolling a long grid. A single mobile breakpoint at 480px reduces hero padding (72px→56px), corner-bracket size (54px→38px), sprig size, and the footer mark — the composition doesn't restructure at small width, it just compresses its ornament.

## Elevation & Depth

Flat by default. Cards carry no resting shadow — separation comes from the `--card` vs `--ivory` tonal step and a 1px `--border` hairline. The only shadow in the system is a hover response: `.card:hover` lifts with `box-shadow: 0 8px 22px rgba(53, 60, 30, 0.12)` and `translateY(-2px)`, both removed at rest.

### Named Rules
**The Hover-Only Shadow Rule.** Shadows exist solely as a state response to card hover; nothing in the system carries a resting shadow, including the hero, nav pills, or buttons.

## Shapes

Two radius steps: `--radius-sm` (9px) for buttons, chips, and card-links; `--radius` (14px) for item cards. Category and nav pills use full pill radius (999px), as does the hero progress indicator. The hero itself is framed not by a full border but by four independent corner brackets (54px, 1px cream-on-olive strokes at ~55% opacity) with a single curved flourish on the top-right corner only — a direct transcription of the reference invitation's asymmetric corner treatment, not a symmetric box. The big-item (no-link) card uses a dashed border in `--claimed-border` to read as intentionally different from a normal card, not a broken one.

## Components

### Buttons
- **Shape:** 9px radius (`--radius-sm`), 44px minimum height on every interactive control (tap-target floor for the mixed-age mobile audience).
- **Claim button (primary action):** olive-outline on `--card` background, olive text; inverts to filled olive background with cream text on hover (`.claim-btn:hover`). Disabled state drops to 0.6 opacity.
- **Undo link (tertiary):** no border, no background, underlined muted text, 12px — deliberately quiet so it doesn't compete with the claim badge above it.

### Chips
- **Category nav pill:** card-background, border-colored outline, ink text; active state fills solid olive with cream text. 44px min-height, pill radius.
- **Card link (purchase link):** sage-soft background, olive-deep text, no border; hover deepens to `sage-soft-hover`. Functions as a chip, not an underlined link, to keep it thumb-sized.

### Cards / Containers
- **Corner Style:** 14px radius (`--radius`).
- **Background:** `--card` (#fffdf7) at rest; `--claimed-bg` when claimed; `--sage-soft` with a dashed `--claimed-border` outline for the four no-link "itens grandes."
- **Shadow Strategy:** see Elevation & Depth — flat at rest, lifted only on hover.
- **Border:** 1px `--border` at rest; swaps to `--claimed-border` for claimed and big-item variants.
- **Internal Padding:** 18px, 12px gap between internal blocks (name, links, claim area).

### Navigation
Sticky pill row (`.cat-nav`), ivory background, centered, wraps on narrow viewports. "Todos" plus one pill per category; `aria-pressed` reflects the active pill and is preserved as an accessibility commitment, not just a visual state.

### Hero (signature component)
Full-bleed radial-gradient olive field (`circle at 50% 18%, #4d5735 0%, var(--olive) 55%, var(--olive-deep) 100%`) framed by four corner brackets and two rotated olive-branch sprigs (one top-left at -8°, one bottom-right at 178°, both at 0.55 opacity so they recede behind text). Content order: heart-flanked rule → "Chá de Panela" (script, display scale) → "Paloma & Guilherme" inside a sage brushstroke highlight, set as the page's single `<h1>` → welcome message (Lora body) → sage progress pill with a heart icon, live-announced via `aria-live="polite"` → closing heart-flanked rule. The brushstroke mark is a single hand-drawn irregular blob path (`mark-brushstroke` symbol), not a rectangle — its irregularity is the point, matching the reference's ink-highlight look.

### Claim state machine (signature component)
Three card states share one component shell: default (link chips + outlined claim button), claimed-by-me (claimed-bg card, badge reading "Você escolheu este presente," visible undo link), and claimed-by-other (identical claimed-bg card, badge reads "Já escolhido por {name}," no undo control). A fourth variant, the no-link big-item card, swaps the link-chip row for a muted "Ainda sem link — fala com a gente" badge and uses the dashed sage-soft treatment instead of the standard card background.

### Footer mark
A hand-drawn line-art illustration of a pot, whisk, and spoon with a small heart on the pot (`mark-kitchen` symbol), rendered in olive-mid, closing the page and tying back to "chá de panela" itself as an object, not just an event name.

## Do's and Don'ts

### Do:
- **Do** keep Alex Brush confined to the two hero name/event moments at display scale; every other string on the page renders in Lora or Cormorant Garamond.
- **Do** use the heart glyph (`#icon-heart-fill`) as the only structural-division device — hero rules, claim badges, progress pill, footer line.
- **Do** hold every interactive control (claim button, undo link, nav pill, card link) to a 44px minimum tap height regardless of visual size.
- **Do** keep claimed-state color in the olive/sage family (`--claimed-bg` / `--claimed-border` / `--claimed-text`), never a generic status green or red.
- **Do** author new ornament as inline SVG line art matching the existing heart/sprig/kitchen-mark stroke weight (~2.2–2.4px, round caps/joins), not as a raster or icon-font glyph.

### Don't:
- **Don't** add a kicker/eyebrow label above any headline. This holds even though the couple's own printed invitation uses one above its headlines — it is a floor-level ban in this build, not a value to relax because the source material does it.
- **Don't** introduce a resting shadow on cards, buttons, or the hero. Shadow appears only as a hover response.
- **Don't** use a symmetric full border on the hero. The corner-bracket-with-one-flourish treatment is deliberate asymmetry transcribed from the reference, not an unfinished border.
- **Don't** substitute a generic forest/status green for claimed state; it must come from the `--claimed-*` triad already defined in the palette.
- **Don't** treat Google Fonts CDN delivery of Alex Brush as fully resolved — see the typography note below.

---

**Known gap (disclosed, not silently carried as resolved):** Alex Brush currently loads from the Google Fonts CDN (`fonts.googleapis.com`) rather than being self-hosted. The finish reviewer scored this low-severity and non-blocking and left it open deliberately rather than fixing it in this pass. A future pass that self-hosts the font should update this note and the `<link>` tags in `src/index.html`; until then this is a known, accepted gap, not a system rule to copy forward.
