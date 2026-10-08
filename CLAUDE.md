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
1. **Story hero (depth scroll)**, replacing the former "Hero line" and "Selected work" cards. No cards at the top: big headlines live in 3D space and tell the artifact's story while you scroll.

#### The effect (Z-axis / depth scroll)
- The hero is a pinned section (GSAP ScrollTrigger, `pin: true`, `scrub: 1`). Pinned for about 5 viewport heights of scroll.
- The headlines sit on a Z axis, one behind the other. The vanishing point is the artifact's position on screen, so text falls into the artifact.
- **Scrolling down:** the current headline shrinks, recedes and drifts toward the center, fading into the fog until the artifact "absorbs" it. The next headline arrives from in front of the viewer: huge and slightly blurred, settling to readable size.
- **Scrolling up** is the exact reverse: text comes back out of the artifact and grows toward you. The closer the text, the bigger it is.
- Each headline has a **hold zone** (about 35% of its scroll length) where it stays sharp, full opacity and readable before it moves. Never have two headlines readable at the same moment.
- Depth cues tied to Z: scale (from perspective), opacity, blur (0px sharp → 8px far), and letter-spacing opening up slightly as the text recedes. The fog color matches the 3D scene fog so text and artifact feel like one space.
- Use a variable font and tie its axes to depth. Up close: heavier weight, large optical size. Far away: thinner weight. It should look like the type itself breathes as it travels.
- The artifact reacts: each time a headline is absorbed, the core pulses once and the particles swirl inward briefly. Small, not a full bloom.
- The mouse still works during the scroll: tilting the text plane a few degrees toward the cursor (parallax), and the artifact keeps leaning toward the cursor.

#### Story copy (placeholders, mark each [EDIT])
1. "It was asleep for a very long time." small line: "Glass, liquid metal, porcelain, a little light."
2. "You woke it." small line: "It noticed you before you noticed it."
3. "It follows your hand." small line: "Move, and it leans in. Rush, and it drifts after you."
4. "Every piece is different. They hold together." small line: "Like any good system."
5. "Now look closer." → this one does not recede. It stays, the pin releases and the page scrolls normally into the rest of the content.

Headline: display font, very large (clamp, about 9–14vw on desktop), tight leading, centered. Small line: text font, about 16–18px, sits under the headline and moves with it, fading earlier than the headline.

#### Fonts
- Headlines: **Fraunces** (Google Fonts, variable: `wght`, `opsz`, `SOFT`). Animate `wght` and `opsz` with depth, and use a little `SOFT` for a sculpted, porcelain feel.
- Small lines and the rest of the page: **Manrope** or **Geist**.
- If you think a different pairing fits the artifact better, give me 2 alternatives with a one-line reason each before building. Don't use Inter, Roboto, Playfair or Montserrat.

#### Technical rules
- Build it with DOM text and CSS 3D (`perspective` on the pinned container, `translate3d` with Z per headline), not inside WebGL, so text stays crisp, selectable and accessible. Align `perspective-origin` with the artifact's projected screen position, recalculated on resize.
- Animate only `transform`, `opacity`, `filter` and `font-variation-settings`. Throttle blur: skip it when a headline is fully transparent.
- All headlines are real `<h2>` elements in reading order. Screen readers get the whole story without scrolling.
- Mobile: same effect, shorter pin (about 3.5 viewport heights), smaller type, no cursor tilt.
- `prefers-reduced-motion`: no Z movement. The headlines stack vertically and simply fade in as they enter.
- Add a thin scroll-progress indicator for the hero (5 dots or a hairline) so people know the story has an end.

2. **Approach**: 3 short principles, 1–2 lines each.
3. **About**: a short paragraph and a portrait slot (an empty frame is fine).
4. **Contact**: email + LinkedIn links and one closing line.

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

## Gallery feature
Source: `Claude cowork/OUTPUTS/living-artifact/PROMPT_gallery_swap_phases.md` (copied in full below).

New feature: "The Gallery". After the hero story, the page shows 4 framed specimens. Each is a live, whimsical 3D piece in the same family as the main artifact but clearly different. Click a frame and the main artifact and that specimen swap places: the clicked one becomes the hero artifact, and the old hero moves into the empty frame.

First: add this whole file to CLAUDE.md under "Gallery feature", log decisions as we go.

### Rules for every phase
- One phase at a time. Commit at the end of each ("Gallery phase N: ..."), tag it (`gallery-p1`, `gallery-p2`...). If a phase breaks something, `git revert` to the last tag, never patch on top of a broken state.
- Everything new sits behind `?gallery` until Phase 6. Without that flag the site behaves exactly as it does now.
- After each phase: run it, list what I should click and what "correct" looks like, and wait for my OK.
- The existing artifact, hero depth scroll and bloom must look and behave identically after every phase. If anything changes, that's a bug.

### Architecture decisions (don't relitigate)
- **One WebGL renderer, one canvas.** Not 5 renderers. Browsers cap WebGL contexts and 5 renderers will kill laptop performance. Render each piece into its own screen rectangle with `renderer.setScissor` / `setViewport`, from a separate scene per piece.
- **A piece is data, not code.** An artifact is built from a "species" config: geometry recipe, materials, palette, particle behavior, idle motion, hover reaction, click-bloom variation. The main stage and every frame just render whichever species they are given. A swap exchanges two configs. It never moves meshes between scenes.
- Only render the frames that are on screen (IntersectionObserver). Frames at rest render at half frame rate.
- Frames, titles and placards are real DOM. Only the artwork is WebGL.

### Phase 1: Make the artifact data-driven (no visual change)
- Extract the current artifact into `species/prime.js`: a config + a `build(config)` function that returns the group, materials and update function.
- The main stage now calls `build(currentSpecies)`.
- Done when: a side-by-side with the commit before looks identical, hover/click/bloom/idle all unchanged, and `window.stage.setSpecies(config)` hot-swaps the main artifact with no animation (debug only).

### Phase 2: Design the 4 specimens in a lab (not in the page yet)
Add `?lab`: a grid showing all species at once, each spinning on its own, so I can judge the designs side by side before they go anywhere near the page.
Each must share the family DNA (translucent glass, liquid metal, porcelain, glowing particles, same fog and bloom) but have a different silhouette, material mix, palette and movement. Proposal (tell me if you have better ideas):
1. **Tide Bell**: jellyfish-like glass bell with long trailing ribbons of liquid metal. Cool teal glow. Pulses slowly like breathing. Hover: ribbons lift and spread.
2. **Clockwork Seed**: brass-colored liquid metal pod made of interlocking plates that rotate against each other. Warm amber core. Hover: plates click open a few degrees.
3. **Porcelain Crown**: a ring of floating porcelain shards that never touch, with a small bright point at the center. Rose and ivory. Hover: shards realign into a perfect ring for a moment.
4. **Static Garden**: nested glass rings and thin spikes growing from a center, like a frozen firework. Violet and ice blue. Hover: spikes bend toward the cursor.
For each, give me: name, 6-word "medium" line (e.g. "Glass, mercury, and borrowed light"), and its core color. Prime gets the same treatment ("The Living Artifact", its own medium line).
- Done when: all 5 render in the lab at 60fps, I've picked what to keep, change or replace.

### Phase 3: Gallery section with frames (static)
- Scroll order: hero story → gallery → rest of the page.
- Heading line for the gallery, placeholder [EDIT]: "Five of them were awake. Choose one."
- Layout: 4 frames in an asymmetrical gallery wall (not a perfect grid): different sizes, slightly staggered, hung at different heights, like a real exhibition. Mobile: single column, large.
- Frame design (DOM/CSS): thin metal frame with a deep inner mat, soft inner shadow, a subtle glass-reflection sheen that moves with the cursor, a small museum placard below (number, name, medium line). Frame material reads as part of the artifact family: dark brushed metal with a faint edge glow in each piece's core color. Not wood, not gold, not skeuomorphic.
- Frames fade and rise in on scroll with a slight stagger. Each frame holds a flat placeholder (the piece's palette as a gradient) for now.
- Done when: it scrolls well on desktop and mobile, no layout shift, placards are readable, and the hero scroll before it is untouched.

### Phase 4: Live pieces in the frames
- Add the shared-renderer, scissor-viewport system from the architecture notes. Each frame gets its own scene, camera and species.
- Each piece is alive at rest (idle float, particles, breathing) and reacts to the cursor while it hovers its frame: the lean, hover reaction and mouse-field particles from the main artifact, scaled down.
- Offscreen frames don't render. Show FPS with `?debug`.
- Done when: all 4 frames are live, scroll stays smooth with all of them visible, and nothing flickers while scrolling or resizing.

### Phase 5: The swap (the signature moment)
Click or tap a frame (or Enter/Space on a focused frame), then:
1. The selected piece lifts out of its frame toward the screen and the frame glass dims.
2. The main artifact (docked at the top of the page) and the selected one cross paths on a short arc. Scale, position and rotation interpolate, with particles streaming along the path. The main one travels into the empty frame, the selected one takes the main stage.
3. Both settle and play their own idle. The newly swapped-in main one does a small version of the bloom. The hero core and fog tint shift to the new piece's color over about 800ms, and so does the glow on the page's accents.
4. The placards update: the frame shows the old main's name, and the main stage shows a small caption with the new piece's name.
- Any piece can swap with any frame, including the one that just moved in. Prime can always come back.
- State machine: `idle → swapping → idle`. Lock input during swap, queue at most one click. About 1.4s total, interruptible with Esc.
- The swap works because species are data (see architecture): during the swap show two temporary renderings of the pieces moving, then assign the configs when they land. No flicker at the handoff.
- Make the main stage scroll-aware: if the main artifact is scrolled out of view when you click, scroll smoothly back to it as the swap starts (or run the swap in place and let the user scroll back, pick the less jarring one and tell me which).
- Done when: swapping each frame with the main one works in both directions, repeated 20 times in a row without glitches or leaked memory, clicking mid-swap can't corrupt state.

### Phase 6: Story, links and accessibility
- A one-line "story" for each piece, shown in the placard on hover or focus and under the main stage after a swap. Placeholders [EDIT], written like the hero copy (short, a little eerie, a little funny).
- Deep links: `#piece=tide-bell` opens the page with that piece as the main artifact. The URL updates after each swap. Shareable.
- Accessibility: each frame is a `<button>` with a label like "Swap Tide Bell onto the main stage", visible focus ring that looks like the frame glowing, `aria-live` announcement after the swap, and a text alternative for every piece.
- `prefers-reduced-motion`: swap becomes a 400ms crossfade, no flight path.
- Remove the `?gallery` flag. The gallery is now part of the site.

### Phase 7: Polish and performance
- Mobile pass (touch hold = hover reaction, tap = swap), low-power fallback (fewer particles, no DOF) when frame rate drops below 40 for 2 seconds.
- Loading: build species lazily, show the gallery frames' gradients until each piece is ready.
- Light shared audio is optional: a very soft glass chime on swap, off by default with a small toggle. Skip it if it adds complexity.
- Final check: Lighthouse, 60fps on a recent laptop, and a short screen recording of the swap for sharing.

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
- 2026-10-07 · Change of plan (from `PROMPT_hero_depth_scroll.md`): the "Hero line" and "Selected work" cards are replaced by a pinned depth-scroll story hero (see Page content, item 1). The four depth numbers live in one `DEPTH_TUNING` object at the top of the script.
- 2026-10-07 · Fonts for v2 are now Fraunces (variable `wght`, `opsz`, `SOFT`) for headlines and Geist for text, per the hero prompt. They replace Option B's Bodoni Moda and IBM Plex. Option B's palette (petrol ground, mineral-white text, frost lead, ember core) and its card style stay.
- 2026-10-07 · Open question: with Selected work removed there are 4 content sections, but the spec still says the shell has 5 pieces, one per section. The piece-to-section mapping must be settled before step 3.
- 2026-10-07 · Hero build: Geist chosen over Manrope (neutral and precise, so Fraunces keeps the character). Story beats are real `<h2>`s in reading order; each small line carries a discreet `[EDIT]` mark.
- 2026-10-07 · Hero build: "letter-spacing opens as the text recedes" is done by spreading words apart with transforms. Animating real letter-spacing would break the "transform / opacity / filter / font-variation-settings only" rule. Line breaks are frozen at the resting weight, so animating `wght` never re-wraps a headline.
- 2026-10-07 · Hero build: the vanishing point is the docked artifact's screen position (`perspective-origin` at 50% / 25%, recalculated on resize). Phone timing (×0.7, 3.5 screens) applies below 640px wide or on touch devices.
- 2026-10-07 · Gallery feature added to this brief (section above). It is built in 7 phases, each committed and tagged `gallery-pN`, behind `?gallery` until Phase 6.
- 2026-10-07 · Hero committed untuned as the gallery baseline and tagged `gallery-p0`. `DEPTH_TUNING` is still open for tuning.
