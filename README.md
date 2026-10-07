# Destiny Roadmap

A static, personal Destiny 2 field guide from post-Iconoclasm to a Prismatic Hunter using Celestial Nighthawk, Still Hunt and Refurbished A499. Includes two later routes: targeted endgame upgrades and campaign catch-up.

**Live:** https://rlawoals0529.github.io/destiny-roadmap/

## Run locally

Requires Node.js 22 or later. The app itself has no dependencies or build framework.

```sh
npm ci
npm run dev
# http://127.0.0.1:4173
npm test
npm run check
npm run build
npx playwright install chromium
npm run e2e
```

The build copies six public files into `dist/`. GitHub Actions validates, tests and deploys that directory through GitHub Pages. The source and tests stay out of the deployed asset directory. `SITE_URL` can point the browser suite at the live site; every test uses an isolated browser context and never touches a real user's progress.

## Content and updates

`data.js` contains sections, tasks, steps, sources, glossary entries and resource counters. Every task includes prerequisites, tags, recommended priority, reason, reward, time estimate, fireteam and gating information. `Build Critical` describes this chosen route, not necessarily an enforced game requirement. Tasks with `recommend: false` are records or reference material, not next-action recommendations.

The snapshot was researched for **2026-10-06**. Official Bungie sources govern the current system; community walkthroughs supply older quest detail and item databases expose current rolls. Recommendations and time ranges are editorial. Read the Sources view for verification limits. The full current Kepler quest-card chain, exact current artifact selections, Spider reward previews, daily vendor prices, live featured rotations and some currency caps still require in-game confirmation. Do not convert an unknown value into a confident claim.

To update:

1. Check official support, sandbox notes and the current item/quest UI.
2. Edit the existing task text and attach the supporting source. Keep IDs stable.
3. Step IDs are assigned as `task-id.1`, `task-id.2`, etc. **Do not reorder, insert or delete existing steps**, which would remap saved progress. Append a step or create a new task ID. Add an explicit migration before changing this contract.
4. Update `checkedOn` and visible snapshot text after rechecking the content.
5. Run content validation, unit tests, browser checks and the build. Preview mobile and desktop.

`core.js` holds pure persistence, import validation, dependency and progress logic. `app.js` renders the views and handles interactions. Prerequisites are recursive: marking an intermediate quest complete without its earlier unlocks does not make a descendant farm ready. Users can record historical completion without having to tick every prerequisite first. Next-action recommendations exclude optional tasks and favor build-critical work before the selected later route.

## Progress and privacy

Progress is stored under **`destiny-roadmap:progress:v1`** in localStorage. It is separate from the portfolio and other projects on the same GitHub Pages origin. Checkbox steps, manual quantities and later-route preference are saved. Theme uses a separate namespaced preference. Updates within the same tab or across tabs rerender progress; simultaneous edits are last-write-wins.

No Bungie sign-in, API token, account inventory fetch, paid backend, analytics, cookies or remote fonts. Initial inventory values are **unknown**, not zero. Counts are manual snapshots, do not affect completion percentage and are not deducted by in-game purchases. Existing progression is not exposed in the repository or sent to GitHub; anyone opening the public site gets their own browser-local copy. GitHub serves the site and may keep normal hosting logs. Other pages on the same origin could access localStorage; use exported backups if browser storage is cleared.

Export downloads JSON with app ID, schema version, checks, quantities, route and timestamp. Import validates the entire file before replacing progress. Only known IDs are retained, unsupported schemas and invalid values are rejected, and files larger than 1 MB are refused. An invalid import or failed storage write leaves the previous state intact. Reset requires a confirmation and restores only the reported Iconoclasm completion. An unreadable saved copy is preserved and can be exported for recovery. Storage failures show a visible warning; in-memory changes can still be exported.

## Design

Existing public Atlas, Ariadne, Shelfwear and portfolio repositories and live sites were inspected read-only. The design uses Ariadne's editorial spacing and serif headings, Atlas's readable task hierarchy, Shelfwear's calm surfaces and the portfolio's restrained night palette. No existing repo was modified and no stylesheet or artwork was copied. System fonts, CSS and native disclosures keep the site small.

## Verification

Unit tests cover initial state, save/reload, import/export, dependency ancestry, recommendation ordering, branch preference, validation, recovery, storage failure, reset, filtering and progress. Browser tests cover actual reload persistence, counts, JSON download/upload, atomic rejection, reset confirmation, prerequisite filtering, mobile overflow, day/night accessibility and asset errors. `npm run check` also validates IDs, source references, dependency cycles and public-file privacy patterns.

Automated accessibility checks are a baseline, not a substitute for every assistive-technology workflow. External source checks may encounter rate limits; do not label a blocked request as a broken link. The app does not publish a live weekly schedule.

Unofficial personal guide. Destiny names belong to Bungie. No game artwork is redistributed.
