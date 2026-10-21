# ClubPlay Phase 1 web delivery

Implemented the lazy-loaded create/join/player/host/projector routes, typed reconnecting Socket.IO client, Zustand view/clock store, Arcade Night UI kit, catalog-driven configuration, and Free Talk GameViews. No commits, resets, checkouts, or stashes were made. No core or server source files were edited.

## Verification

All requested checks pass:

- `pnpm --filter @clubplay/web build`
- `pnpm --filter @clubplay/web typecheck`
- `pnpm exec tsc -p packages/ui/tsconfig.json`
- `pnpm exec tsc -p packages/games/free-talk/tsconfig.json`
- `pnpm exec eslint apps/web packages/ui packages/games/free-talk/src/views` — zero errors or warnings
- `pnpm --filter @clubplay/web test` — 14 tests across 3 files
- `pnpm -r test` — 47 tests pass: core 8, web 14, Free Talk 2, Secret Word 5, server 18; UI components are exercised by the web rendering tests
- `pnpm --filter @clubplay/web size` — 165,301 bytes gzip for Player and every static JS dependency; asserts <200,000 bytes and excludes Host/Display entry points

Tests cover store patch merging and stale patches; clock correction with the smallest RTT; corrected, paused, expired and warning timers; all five config field kinds and real server-rendered controls; hidden player/host secrets absent from HTML; and valid lifecycle controls, including mixed group phases.

## Build sizes

These are the fresh Vite build's reported decimal kB gzip; the full output is in `apps/web/build.log`.

| JavaScript chunk | Raw kB | Gzip kB | Player dependency |
|---|---:|---:|---|
| index-GkPwsiM6.js | 259.19 | 82.52 | Yes |
| socket-DTeOO11A.js | 237.01 | 71.88 | Yes |
| MobileToaster-jLjaBaqT.js | 34.15 | 9.61 | Yes |
| registry-BCAsJIer.js | 3.61 | 1.49 | Yes |
| Player-9YdVOLEv.js | 2.93 | 1.30 | Yes |
| Display-dy0Fjwll.js | 167.55 | 56.08 | No |
| Host-BsaEA1Xq.js | 15.09 | 5.31 | No |
| Home-OBgkk2PY.js | 2.84 | 1.26 | No |
| Join-D5aK2G1_.js | 2.16 | 1.05 | No |
| gamepad-2-BWHmETMF.js | 0.65 | 0.40 | No |
| scan-line-CKFFbQrI.js | 0.36 | 0.24 | No |
| arrow-right-BrtIhDtP.js | 0.19 | 0.18 | No |

The Player total from Vite's rounded chunk figures is **166.80 kB gzip**, below 200 kB. The repeatable size script uses Node's default gzip and reports **165.30 kB** for the same five files; compression implementations/options explain the small difference. QR, confetti, Motion projector code, and host controls are outside the Player dependency graph. Shared CSS is 67.42 kB raw / 24.55 kB gzip; self-hosted fonts are separate assets.

## Browser and live smoke

The existing process on port 3000 was an unrelated Next.js app and was left alone. With coordinator approval/instruction, ran ClubPlay on 3100 and Vite on 5173 with `CLUBPLAY_SERVER_URL=http://localhost:3100`; Vite keeps the required 3000 default when no override is provided.

Live Orca-browser smoke passed: create lobby; join as Thảo; issue a pairing token, remove the stored host token and claim through the paired host route; live player list; assign a team and match it on projector/player; add two late players and reassign; select Free Talk, render/save catalog settings, prepare and start; receive prompt and speaking order; reload the player with the same name/team/order and timer 0:50 → 0:49; kick through two Drawers and receive the removed screen; close through a Drawer and receive the ended screen. The projector hid pairing controls while the host was attached.

Geometry/accessibility checks used 360×780 Player, 390×844 Host, and 1920×1080 Projector with Boost. Both 60-player/four-team and 60-player/eight-team projector fixtures fit without scrolling or clipped group bodies; names remain 28px and timers 48px. Host controls fit at 390px, remain at least 48×48px, and use 16px labels. Vietnamese names use Be Vietnam Pro and the browser FontFaceSet confirmed the Vietnamese test string is loaded. Hold-to-reveal mounted one host order while held and removed it on release.

The embedded browser could not produce screenshots (`Page.captureScreenshot`: page did not draw a frame), so visual checks used DOM geometry, computed styles, font loading and accessibility snapshots. Physical phone vibration, wake lock and real QR scanning were not tested on hardware. Reduced-motion behavior is implemented with CSS overrides, Motion's preference hook and disabled confetti.

## Design adaptations and boundaries

- Used installed static `@fontsource/be-vietnam-pro` weights 400/500/600/700 with explicit Vietnamese imports because `@fontsource-variable/be-vietnam-pro` does not exist. Unbounded's default stylesheet includes Vietnamese; its actual CSS family is `Unbounded Variable`, which the display token now uses.
- Crowded wide projector cards use three name columns (four for a very large single team) instead of the default two. This keeps all 60 names on screen at the required font size. Compact card spacing and a one-row header/footer preserve 48px timers without clipping.
- Projector pairing and Boost controls follow the task's explicit requirements despite DESIGN §9's general restriction on projector buttons. B still toggles persisted Boost; fullscreen and cursor hiding are implemented.
- Covered secret content unmounts immediately on release, cancel, lost pointer capture, blur or page hiding. Hidden host rows blur a placeholder instead of retaining secret content in the DOM.
- Radix primitives and Vaul were added to `@clubplay/ui` with `pnpm --filter @clubplay/ui add vaul radix-ui`; pnpm updated the workspace lockfile automatically. The lockfile was never hand-edited.
- No changes to DESIGN.md were made because that document is outside this worker's ownership. The UI kit exports the exact supplied GameViews/GameViewProps contract plus its required components.
- Secret Word view registration remains the coordinator's responsibility, as instructed. Free Talk is registered in the web registry.

## Files delivered

- `apps/web/index.html`, `vite.config.ts`, `tsconfig.json`, `package.json` (size script), `src/main.tsx`, `src/styles.css`
- `apps/web/src/routes/{Home,Join,Player,Host,Display}.tsx`
- `apps/web/src/socket/{index,clock}.ts`, `src/store/index.ts`, `src/games/registry.ts`
- `apps/web/src/components/{ConfigForm,HostGame,MobileToaster,session}.tsx`, `{config-fields,game-controls}.ts`
- `apps/web/test/{helpers.test.ts,rendering.test.tsx,game-controls.test.ts,browser-fixture.ts}`
- `apps/web/scripts/check-size.mjs`, `IMPLEMENTATION.md`, `REPORT.md`, `build.log`
- `packages/ui/package.json`, `src/{index.ts,components.tsx,game-views.ts,timer.ts}`, `src/styles/{tokens,components}.css`
- `packages/games/free-talk/src/views/index.tsx`
- Automatically updated workspace `pnpm-lock.yaml` dependency importer entries

Both smoke-test dev servers were stopped and the four worker-created browser tabs were closed; the unrelated port 3000 app was left running. The coordinator can review and integrate the uncommitted work. No implementation blockers remain in this worker's scope.
