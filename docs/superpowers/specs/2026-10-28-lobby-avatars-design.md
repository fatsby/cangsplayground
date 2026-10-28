# Big Smile lobby avatars

Status: implemented and verified, including minigame coverage and circular avatars.

## Intent and agreed behavior

Students can customize a DiceBear Big Smile avatar while waiting in the lobby,
before the host selects a game. Use the Pastel Wall preset with backgrounds
`ffe3ea`, `e3edff`, `e2f5e9`, `fdf1d4`, and `efe6ff`.

The user selected individual customization plus randomization: hairstyle, hair
color, skin color, eyes, mouth, accessories, and background, with a live preview,
a Randomize button, and a Save button. Selecting a game closes the editor.

## Approaches

- Render in the browser with `@dicebear/core@10.7.0` and the Big Smile definition
  from `@dicebear/styles@10.6.0`. The registry currently publishes the style
  definitions at 10.6.0, despite the combined documentation listing 10.7.0.
  Preview changes do not need image requests.
  This is the proposed implementation choice; it adds client JavaScript.
- Render through the DiceBear HTTP API. This needs fewer client dependencies,
  but previews and avatar display depend on an external network service.

Use browser rendering because this feature involves repeated previews on student
phones. Load the Big Smile renderer in a shared asynchronous chunk to preserve
the existing player bundle budget. Reserve circular space while loading; a local
error boundary shows a simple smile if the renderer cannot load, keeping the game
and editor controls available.

## Student experience

- Give each student a deterministic default avatar from their player ID using
  the complete Pastel Wall palette; leave unspecified appearance options seeded.
- Show an avatar card alongside the existing lobby waiting or team information.
  Editing is available whenever `view.game === null`, whether grouped or ungrouped.
- Use a mobile-friendly editor with an always-visible preview and labeled controls.
  Keep UI copy in English to match the current application.
- Changes stay in a local draft until Save. Randomize chooses a new appearance;
  the student can then adjust individual parts. Cancel discards the draft.
- Save publishes the complete configuration once, shows pending/error feedback,
  and closes on success. Disable Save while disconnected or awaiting a reply.
- When a game is selected, discard any unsaved draft and close the editor.
  Reopen customization when the host exits back to a lobby without a game.

## Data and synchronization

- Add a shared, validated avatar configuration containing a seed and optional
  supported appearance selections; permit only the five Pastel Wall backgrounds.
- Add a player-authenticated avatar update event. Derive the player from the
  socket attachment rather than accepting a target player ID.
- The server checks that the lobby is open and no game is selected before updating.
  This also handles a Save racing with the host selecting a game.
- Store the configuration on the existing in-memory Player record and include it
  in public player summaries. Preserve it across reload, reconnect, regrouping,
  and games for the lifetime of that lobby record.
- Show saved avatars beside names in the player header, host player list,
  projector lobby list, and shared team rosters.
- All avatars are circular, including the editor preview, with fixed square
  dimensions, `border-radius: 50%`, and clipping. Preserve room for long names.
- Add avatars where space permits in all four minigames: Free Talk speaking
  order and turn indicators; Secret Word turn indicators and revealed word
  rows; Who's the Spy vote candidates, tally, eliminated player and revealed
  identities; Shark Tank presenters, question participants, closing speakers,
  preparation assignments, and result team members.
- Preserve existing game identity/privacy rules: appearance never depends on
  hidden role, secret word, or game status. Keep dense textual summaries compact.
- Use a shared avatar renderer with an isolated SVG image data URI. Include
  attribution for Big Smile / Ashley Seo and the CC BY 4.0 license.

## Scope and validation

No accounts, image uploads, cross-lobby persistence, or new database storage.
Configuration choices beyond those agreed above are implementation decisions.

Verify valid/invalid avatar payloads, player authorization, synchronization to
host/projector/player views, reconnect persistence, and rejection after game
selection. Verify editing, randomization, saving, cancellation, offline behavior,
and automatic closure on game selection. Run relevant tests, workspace typecheck,
lint, production build, and the existing player bundle size check.

## References

- https://www.dicebear.com/styles/big-smile/presets/
- https://www.dicebear.com/integrations/javascript/
- https://www.dicebear.com/llms-full.txt
