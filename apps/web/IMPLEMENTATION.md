# CangsPlayground web implementation ledger

The dispatched design and Phase 1 implementation document are the approved specification. Work remains in the assigned paths; no commits, resets, or worktree changes.

1. Add failing tests for top-level store patches, min-RTT clock samples and timer labels, and config field normalization (all five field kinds).
2. Implement the UI tokens and required components, including accessible hold-to-reveal and Vaul confirmations. Export the exact GameViews contract.
3. Implement the Zustand view store and typed socket transport with reconnect attachment, credential cleanup, clock probes, and fresh host command IDs.
4. Implement lazy create/join/player/host/projector routes and Free Talk views. Keep QR and host controls outside player entry dependencies.
5. Run web/UI/game typechecks, scoped lint, unit tests and Vite build; record gzip dependency totals. Smoke create/join/assign if port 3000 is available.

Review focus: stale patches cannot overwrite newer snapshots; paused timers must not run; missing or expired credentials must return to the correct entry screen; hidden secrets must not remain in the player DOM; reassign confirmation retries must have a fresh command ID.

Rulings: static Be Vietnam Pro 400/500/600/700 replaces the unavailable variable package, including Vietnamese subsets. Pairing controls and Boost control appear on projector as explicitly required by this task despite DESIGN §9's general no-controls rule. The existing shared workspace is mandatory, so no isolation or commits are performed.

Completed: shared helpers and 14 tests; UI kit/tokens; socket/store; all lazy routes and Free Talk views; all requested checks; full 47-test workspace suite; live create/join/pair/assign/game/reload/kick/close smoke. Delivery evidence and design adaptations are in REPORT.md. Final bundle check: Player with all static JS dependencies is 165,301 bytes gzip (Node) / 166.80 kB using Vite's rounded figures.
