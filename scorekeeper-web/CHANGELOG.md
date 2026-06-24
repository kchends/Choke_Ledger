# Changelog

All notable changes to this project are documented here. Each version bump increases the VERSION file by 0.0.1.

## v0.0.1 - 2026-06-23
- Baseline snapshot: current working state of the web app pushed as initial baseline. Includes UI, events, skill-rate editor (client PIN 0715), offline test helpers, and chart fixes.

---

## v1.2.27 - 2026-06-23
- Fix: restore non-edit DOM after exiting edit mode (rehydrate name/sub elements) so Save/Cancel correctly return to default view on mobile.
- Fix: force-render bypass added to guarantee UI refresh after Save/Cancel on mobile devices.
- Fix: minor responsiveness improvements for expand/collapse (optimistic placeholder while fetching events).

## v1.2.26 - 2026-06-23
- Fix: improved mobile edit UX — Save/Cancel now immediately exit edit mode (optimistic UI) and reliably handle touch events.
- Fix: expand/collapse now responds instantly on tap by showing a loading placeholder and fetching events in background.
- Fix: replaced nested async IIFEs with Promise-based handlers to avoid syntax errors on some browsers.

## v1.2.25 - 2026-06-23
- Fix: mobile touch handlers improved — Save/Cancel now reliably work on mobile (touchend/pointerup delegation + dedupe) and edit mode exits cleanly.
- QoL: delegated click handler now handles touch events and prevents duplicate touch+click firing.

## v1.2.24 - 2026-06-23
- Fix: re-enabled in-place player edit UI and ensured Edit button triggers a forced re-render so inline editor appears reliably.
- Fix: clear render snapshot when entering/exiting edit mode to avoid no-op render short-circuit.

## v1.2.23 - 2026-06-23
- Fix: eliminated most UI flicker by implementing granular per-player DOM patching (only changed nodes updated), avoiding full list redraws.
- Fix: ensure skill rates panel measures/positions after layout (requestAnimationFrame) to prevent first-open misplacement.

## v1.2.22 - 2026-06-23
- Fix: skill rates panel first-open placement measured after display to ensure correct desktop positioning; fixes first-click misplacement.
- Fix: skip server merge while document.hidden to avoid background layout churn; increased poll interval to 10s.

## v1.2.21 - 2026-06-23
- Fix: greatly reduced UI flicker by skipping no-op re-renders and increasing server poll interval; render now diffs a compact snapshot before updating.
- Fix: further mobile scroll stability improvements.

## v1.2.20 - 2026-06-23
- Fix: skill rates panel now preserves mobile layout and desktop positioning; clicking the button toggles open/close without hiding the button.
- Fix: ensure panel does not overlay the Skill rates button on desktop (button gets higher z-index while open).

## v1.2.19 - 2026-06-23
- Fix: desktop skill-rates toggle made bi-directional (click to open/close); reduced flicker by only re-rendering when server data changes.
- Fix: prevent oversized audit snapshots from failing by truncating large change/snapshot payloads before writing.

## v1.2.18 - 2026-06-23
- Fix: reduced phone scroll-jump by toggling skill rates panel via CSS class (no layout reflow); uses opacity/transform instead of display.
- Fix: improved Mark Paid reliability by retrying server paid-event creation (3 attempts) and added alignment fixes for donor controls.

## v1.2.17 - 2026-06-23
- UI: clearer player card highlights — removed gradient side bars; highlights now use solid translucent background colors (purple for Choke Champion, green for Biggest Contributor, gold when both).
- UI: stronger badge contrast — donor badge now matches prominence of Choke Champion; badges remain top-right and non-blocking.
- Fix: updated styles to avoid visual stripes and improve mobile/desktop parity.

## v1.2.16 - 2026-06-23
- UI: moved badges to the top-right corner of player cards and reduced badge size so they don't overlap or push text; badges are absolutely positioned above content.
- Mobile: adjusted badge positions and sizes to ensure they don't obstruct controls; badges are stacked vertically at top-right.
- Policy: assistant will auto-update local CHANGELOG.md and VERSION for every local change (no approval required).

## v1.2.15 - 2026-06-23
- Mobile: fixed skill rates panel overflow by rendering as a non-blocking overlay on small screens; it no longer pushes content off-screen.
- Mobile: increased gap between chart panels to avoid title/legend overlap.
- UI: badges now render above text (absolute positioning) so they don't crowd player text; reduced badge size on mobile.
- Policy: local changelog and VERSION are updated automatically by the assistant for each local change (no approval required).

## v1.2.14 - 2026-06-23
- Mobile: improved responsive layout for phones — increased spacing between chart panels, reduced badge size, stacked player-card content and moved controls below player info for better readability.
- Mobile: skill rates panel made non-blocking on small screens (renders as inline panel), preventing horizontal overflow; buttons reduced and badges wrapped.
- UI: removed decorative side bars from highlighted cards so background color is the only highlight.

## v1.2.13 - 2026-06-23
- UI: stronger player card borders, card-like layout, hover lift, and clearer separation between player records.
- UI: added "Biggest Contributor" badge (green) and "Choke Champion" badge (purple); when both are present the card highlights gold and displays both stripes.
- UI: improved history panel styling (expanded, MM-DD under year headers) and event panel visuals for better readability.
- UX: refined badge styles, donor/mvp parity, and improved Mark paid/Revert visibility.

## v1.2.12 - 2026-06-23
- Feature: "Mark paid" records PAID events (visible across devices) and creates audit change entries; added reversible "Revert paid" requiring PIN.
- History: combined miss+change events, grouped by year with MM-DD, shows last 5 entries with "Show more".
- UX: delete-player confirmation, improved history wording for skill-rate edits and paid events.
- Bugfix: history list now updates when new misses/paid events are added; incPlayer double-counting fixed.
- Misc: duplicate names auto-suffixed; pre-commit hook added to require CHANGELOG.md and VERSION staged.

## v1.2.11 - 2026-06-23
- Fix: skill-rate reset now persists to server so subsequent miss events use the updated rates.
- Fix: inc (+) handling — eliminated double-counting and merge overwrites so + is responsive and stable.
- UI: skill rates panel is read-only by default; editing requires PIN and auto-locks after Save/Reset.
- Feature: "Mark paid" button (replaces Erase) records a PAID event, appends to history, and writes a server-side event so other clients can see it.
- History: grouped by year with MM-DD date format; PAID events labeled clearly and include previous balance.
- UX: chart label color/alignment fixed (black labels); added spacing between charts and player list.
- Feature: duplicate player names auto-suffixed ("Name (2)").
- Audit: paid/reset actions create change entries to preserve before snapshots.

## v1.2.10 - 2026-06-23
- Security: skill rates editing now requires an admin password (client-side session). Password: 0715. Edits persist to Firestore config/skillRates.
- Note: this client-side PIN is not secure; enforce admin access via server-side Firestore rules or an authenticated admin flow for real protection.


## v1.2.9 - 2026-06-23
- Feature: skill rates now persisted to Firestore under config/skillRates and retrieved at event time. Miss events record the server rate at creation so later skill changes won't retroactively change past events.

## v1.2.7 - 2026-06-23
- Localhost now uses the production project credentials but writes into the "players-test" collection to avoid polluting production "players".

## v1.2.6 - 2026-06-23
- Feature: local dev uses a separate test Firestore project by default when running on localhost; prevents test writes from polluting production.
- Tooling: added create-zip.ps1 which can package a production ZIP (use -Prod) that forces production DB at runtime.
- Config: TEST_API_KEY/TEST_PROJECT/TEST_DB_ID populated from provided firebaseConfig (TEST_DB_ID set to '(default)').

## v1.2.5 - 2026-06-22
- Feature: expandable per-player event view. Click a player's name to expand a chronological list of miss events (timestamp, skill at time, rate) that sum to amountOwed.
- UX: removed the top "Your name (optional)" input box.

## v1.2.4 - 2026-06-22
- Fix: merging server player docs now preserves amountOwed so changing a player's current skill no longer rewrites prior owed totals.
- Fix: per-miss events respected for calculating totals and leaderboards (amountOwed used as source of truth).

## v1.2.3 - 2026-06-22
- Fix: amount owed now stored/used from amountOwed so changing a player's skill level no longer retroactively changes previously owed amounts.
- Fix: ranking/sorting now uses amountOwed (fallback to computed rate if missing) so leaderboards remain stable.
- Internal: updated app-v4.js to use amountOwed for totals, charts and sorting.

## v1.2.2 - 2026-06-22
- Added CHANGELOG.md to track versioned changes.
- Labeled inline editor numeric fields: "Skill (1-9)" and "Misses:".
- Bumped VERSION to v1.2.2.

## v1.2.1 - 2026-06-22
- Labeled the two numeric edit fields in the inline editor.

