# Changelog

All notable changes to this project are documented here. Each version bump increases the VERSION file by 0.0.1.

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

