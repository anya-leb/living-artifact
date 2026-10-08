# The Living Artifact — Landing Page (v2 prompt)

You already built "The Living Artifact": a floating 3D sculpture (glass, liquid metal, porcelain, glowing particles) that reacts to the cursor and blooms when clicked. Keep everything from that build: materials, idle motion, hover reaction, particle field, mouse-field trail, bloom.

Now turn it into a **landing page**. The artifact is the front door. Opening it reveals the site.

## Core idea
The bloom is no longer a 3-second trick that resets. **The bloom IS the page transition.**
- Closed: dark, almost empty, just the artifact (exactly like v1).
- Click (or scroll, or Enter): the artifact unfolds. Its shell pieces fly outward and **become the page's sections**. The glowing core becomes the page's light source and the background warms from near-black to a lit, deep tone.
- Open: a real, readable, scrollable landing page. The artifact stays alive, smaller, as an anchor on the page.
- Click the artifact again (or Esc / the back button): the pieces fly back, reassemble, and the page returns to dark.

## States (build this as an explicit state machine)
| State | What the viewer sees | How you get there |
|---|---|---|
| `closed` | v1 experience. Title "THE LIVING ARTIFACT", tiny hint "Move your cursor · click to open". | Page load; closing from `open` |
| `opening` | ~2.2s cinematic: shell splits into N pieces, core flares, particles burst outward, camera pulls back and the whole structure turns 360°. Then the pieces travel to the positions of the section cards while DOM content fades/rises in behind them. | Click / tap the artifact; Enter or Space while it has focus; first scroll or swipe; `#open` in the URL |
| `open` | Landing page content (see below). Artifact docked (top center, ~30% size), still floating and reacting to the cursor. One shell piece is missing from it for each section, and they are reflected in the section cards. | End of `opening` |
| `closing` | Reverse of `opening`, ~1.6s, faster and calmer. Content fades out first, then pieces fly home and reassemble. | Click the docked artifact; Esc; browser back; a small "close" link |

Rules:
- Input is locked during `opening` / `closing` (queue at most one action).
- Sync state with the URL hash (`#open`) so the page can be linked open and the back button works.
- Never show the bloom-then-reset from v1 in `closed` state. A short "half bloom" on long hover (≥1.2s) is fine as a teaser that invites the click.

## The shell-pieces-to-sections mapping (the signature moment)
- The shell has exactly as many pieces as there are sections (5).
- Each piece has its own accent tint (keep within one restrained palette).
- During `opening`, each piece flies to the top-left corner of its section card and settles there as a small 3D icon that keeps slowly turning.
- In `open`: hovering a section card makes its piece glow and the matching gap in the docked artifact flicker. Scrolling to a section rotates the docked artifact to face that gap and shifts the core's color to that section's tint.
- This has to read as one continuous object breaking apart into a page, not a 3D intro followed by a separate website.

## Page content (placeholders, mark every one with [EDIT])
1. **Hero line**: a name and a single-sentence positioning statement. Large, quiet type. Example placeholder: "[EDIT] Hanna Lebedynska — product designer who turns systems into stories."
2. **Selected work**: 3 cards (title, one-line outcome, tag, link). Placeholders: "[EDIT] Design system & Figma-to-Storybook pipeline", "[EDIT] BuildBook AI", "[EDIT] Gesture Character Creator".
3. **Approach**: 3 short principles, 1–2 lines each.
4. **About**: a short paragraph and a portrait slot (an empty frame is fine).
5. **Contact**: email + LinkedIn links and one closing line.

Content is real HTML text over the WebGL canvas: selectable, readable by screen readers, indexable. Never render text inside WebGL.

## Visual direction for the open state
- Keep the gallery mood. It should still feel like an exhibition, not a template.
- Typography: one distinctive display face + one clean text face from Google Fonts. Generous spacing. No stock gradient buttons, no emoji, no generic SaaS cards.
- Section cards: frosted glass panels (backdrop-filter blur) that pick up the artifact's light, with thin 1px borders.
- The particle field keeps running behind the content at lower density, still disturbed by the cursor.
- Scroll motion: subtle parallax between canvas and content. Content reveals on scroll (opacity + 12–20px rise), nothing flashy.

## Interaction carried over from v1 (keep it all)
Mouse rotation with inertia, lean toward the cursor, hover reaction (faster particles, brighter core, parts moving independently), mouse-field particle disturbance, idle float/breathe/occasional surprise, and the v1 materials and post effects (bloom, DOF, fog, chromatic aberration). In `open`, scale effects down so text stays crisp: no DOF or chromatic aberration over content.

## Accessibility and robustness
- The artifact is a real `<button aria-label="Open the artifact">` laid over the canvas, focusable and keyboard operable. Move focus to the hero heading after opening and back to the artifact after closing.
- `prefers-reduced-motion`: no camera moves, no 360° turn. Opening becomes a ~400ms crossfade with the pieces simply appearing in place. Particles slow down.
- Touch: tap = click, touch-hold = hover reaction, swipe up = open. Optionally use device tilt for rotation when permission is granted.
- No WebGL: show a static rendered poster image of the artifact and the full content page underneath.

## Technical
- One self-contained `index.html`. Three.js through an import map from a pinned CDN version, GSAP + ScrollTrigger pinned too. No build step.
- Drive every transition from one GSAP timeline per direction so it can be reversed and interrupted cleanly.
- Performance: cap devicePixelRatio at 2 in `closed` and 1.5 in `open`. Pause the render loop when the tab is hidden. Lower post-processing quality when the canvas is scrolled mostly out of view. Target 60fps on a recent laptop.
- Add `?debug` to show FPS and the current state.

## Build order (stop and show me after each step)
1. Refactor the v1 artifact into modules inside the one file: `artifact`, `particles`, `post`, `input`, `stateMachine`. No visual change.
2. Add the state machine, URL hash and the opening/closing timelines using placeholder DOM boxes.
3. Do the piece-to-card flight and docking (the signature moment). Polish it until it reads as one object.
4. Add real content, typography and scroll behavior.
5. Accessibility, reduced motion, touch, fallback, performance pass.

## Done means
- Loading the page shows only the artifact.
- One click opens a readable landing page in under 2.5s, and the transition looks continuous.
- Back button / Esc / clicking the artifact closes it cleanly, mid-transition included.
- Keyboard only and reduced-motion users can reach all content.
- Still smooth on a MacBook Air.

## Decisions
Log of choices made while building v2. Newest at the bottom.

- 2026-10-07 · Project folder is `Claude Code/living-artifact/` (v1 lives here). The spec came from `Claude cowork/OUTPUTS/living-artifact/LANDING_PAGE_PROMPT.md`; this file is its copy.
- 2026-10-07 · Git repo started in this folder. Commit `5357e93` is v1 untouched. One commit per build step.
- 2026-10-07 · Local preview: `preview_start {name: "living-artifact"}` (an inline Node static server on port 5188). Python's `http.server` can't read ~/Desktop, and Vite would swap in an older Three.js.
- 2026-10-07 · Open-state look: **Option B, "Specimen lab"**. Ground warms from blue-black to deep petrol; mineral-white text; frost leads, ember only in the core. Bodoni Moda (display, high-contrast italic) + IBM Plex Sans (text) + IBM Plex Mono (tags, catalogue numbers). Cards: clear frosted glass, 1px border, corner registration marks, mono catalogue numbers.
- 2026-10-07 · Step 1 keeps v1's object-creation order and `Math.random()` call order, so v1 and the refactor can be compared pixel for pixel under a fixed seed.
- 2026-10-07 · Step 1 verified: v1 and the refactor give 0 differing pixels in 6 states (idle, hover, burst, open, closing, after) at a fixed seed with manually stepped frames. Harness lives in `.test/` (git-ignored locally); `?debug` exposes `window.LA.step(n)`.
- 2026-10-07 · Accepted: during `opening` the 5 pieces land on a visible 5-item index under the hero (it also works as navigation). Each piece then glides from the index to its section card as that section scrolls into view. This replaces the spec's direct flight to off-screen cards.
- 2026-10-07 · Accepted: the docked artifact sits top-centre in the hero, then shrinks into a top corner once the hero scrolls past.
- 2026-10-07 · Declined (spec stands): frosted blur on every card and DPR 1.5 in `open`; no special scroll-swallowing (the page only becomes scrollable once `open` is reached, per the input-lock rule); device tilt stays optional.
- 2026-10-07 · Step 2: GSAP 3.13.0 via the import map (`gsap` ESM from jsDelivr). Both timelines are created paused and advanced from `tick()` with the simulation clock, so they pause with the tab and run deterministically under `?debug` stepping.
- 2026-10-07 · Step 2: the shell is now 5 glass petals (one per section) and the calyx has 5 scallops. This is the one intentional change to the closed look.
- 2026-10-07 · Step 2: the v1 bloom-then-reset is gone. Closed state keeps a long-hover teaser (≥1.2s): the shell parts slightly and the core warms. Hint text is "Move your cursor · click to open" ("Touch and drag · tap to open" on touch). The v1 "Click to open it." whisper was dropped as redundant.
- 2026-10-07 · Step 2: the artifact `<button>` (spec step 5) went in now because content covers the canvas once open. It follows the sculpture on screen each frame. Pointer moves are read on `window` so the cursor field works over content.
- 2026-10-07 · Step 2: requests during a transition are queued (one slot). Esc or back during `opening` closes right after the opening finishes. `#open` is pushed when opening from the page; closing from the page calls `history.back()` if we pushed it, otherwise it strips the hash.
- 2026-10-07 · Step 2: open-state room colour is petrol `#0b1f25` (closed `#030407`). Dock is top-centre, scale 0.42, centre at NDC y 0.5. Placeholder boxes start at 46vh.
