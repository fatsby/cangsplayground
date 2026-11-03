// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  GAME_VOTE_DURATION_MS,
  type GameVoteView,
  type LobbyView,
  type Viewer,
} from "@cangsplayground/core";
import { HostGame } from "../src/components/HostGame";
import Display from "../src/routes/Display";
import Player from "../src/routes/Player";
import { useLobbyStore } from "../src/store";
import { spyLobby } from "./spy-ux-fixture";

const { hostCommand, request, errorToast } = vi.hoisted(() => ({
  hostCommand: vi.fn(async (_event: string, _payload: unknown) => ({ ok: true })),
  request: vi.fn(async (_event: string, _payload: unknown) => ({ ok: true })),
  errorToast: vi.fn(),
}));
vi.mock("../src/socket", () => ({ readToken: () => "token", hostCommand, request }));
vi.mock("sonner", () => ({ toast: { error: errorToast } }));
vi.mock("../src/components/MobileToaster", () => ({ MobileToaster: () => null }));
// happy-dom cannot run Web Animations, and these tests are about content, not motion.
vi.mock("motion/react", async () => {
  const { createElement } = await import("react");
  const passthrough = (tag: string) =>
    function Passthrough({
      children,
      layout: _layout,
      layoutId: _layoutId,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) {
      return createElement(tag, props, children);
    };
  return {
    LayoutGroup: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => true,
    motion: new Proxy({}, { get: (_target, tag: string) => passthrough(tag) }),
  };
});
vi.mock("../src/components/session", () => ({
  useRole: () => "",
  useWakeLock: () => {},
  SessionBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

const NOW = 1_000_000;
function vote(overrides: Partial<GameVoteView> = {}): GameVoteView {
  return {
    status: "OPEN",
    options: [
      { gameId: "free-talk", name: "Free Talk", votes: 2 },
      { gameId: "secret-word", name: "Secret Word", votes: 1 },
    ],
    timer: { endsAt: NOW + 42_000, pausedRemainingMs: null, durationMs: GAME_VOTE_DURATION_MS },
    votedCount: 3,
    eligibleCount: 4,
    winnerId: null,
    myVote: null,
    ...overrides,
  };
}
/** A lobby with no game selected, players not yet in groups, and the given vote on screen. */
function voteLobby(viewer: Viewer, gameVote: GameVoteView | null): LobbyView {
  const lobby = spyLobby();
  const second = { ...lobby.catalog[0]!, id: "free-talk", name: "Free Talk" };
  return {
    ...lobby,
    viewer,
    game: null,
    groups: [],
    players: lobby.players.map((p) => ({ ...p, groupId: null })),
    catalog: [{ ...lobby.catalog[0]!, name: "Who's the Spy" }, second],
    me: viewer.kind === "player" ? { playerId: viewer.playerId, name: "Ada", groupId: null } : null,
    gameVote,
  };
}
const serverNow = () => NOW;
const buttons = (container: ParentNode) => [...container.querySelectorAll("button")];
const buttonByText = (container: ParentNode, text: RegExp) =>
  buttons(container).find((b) => text.test(b.textContent ?? ""));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  hostCommand.mockClear();
  request.mockClear();
  errorToast.mockClear();
  // The projector asks the server for its public URL on mount; there is no server here.
  vi.stubGlobal("fetch", async () => ({ ok: false }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  useLobbyStore.getState().setConnection("online");
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

async function renderPlayer(lobby: LobbyView) {
  useLobbyStore.getState().sync(lobby);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/play/ABC234"]}>
        <Routes>
          <Route path="/play/:code" element={<Player />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}
async function renderDisplay(lobby: LobbyView) {
  useLobbyStore.getState().sync(lobby);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/display/ABC234"]}>
        <Routes>
          <Route path="/display/:code" element={<Display />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}
async function renderHostGame(lobby: LobbyView, busy = false) {
  await act(async () =>
    root.render(
      <HostGame
        view={lobby}
        busy={busy}
        serverNow={serverNow}
        select={() => {}}
        configure={async () => true}
        control={() => {}}
        startGameVote={(gameIds) => void hostCommand("gameVote:start", { gameIds })}
        clearGameVote={() => void hostCommand("gameVote:clear", {})}
      />,
    ),
  );
}

it("shows a player with no group the ballot with live counts and highlights their own pick", async () => {
  await renderPlayer(voteLobby({ kind: "player", playerId: "p0" }, vote({ myVote: "free-talk" })));
  expect(container.textContent).toContain("Vote for the next game");
  expect(container.textContent).not.toContain("Your teacher will add you");
  const free = buttonByText(container, /Free Talk/)!;
  const secret = buttonByText(container, /Secret Word/)!;
  expect(free.getAttribute("aria-pressed")).toBe("true");
  expect(secret.getAttribute("aria-pressed")).toBe("false");
  expect(free.textContent).toContain("2");
  expect(container.textContent).toContain("3 of 4 voted");
});

it("sends the chosen game when a player taps it, and reports a rejected vote", async () => {
  await renderPlayer(voteLobby({ kind: "player", playerId: "p0" }, vote()));
  await act(async () => buttonByText(container, /Secret Word/)!.click());
  expect(request).toHaveBeenCalledWith("gameVote:cast", { gameId: "secret-word" });
  request.mockResolvedValueOnce({ ok: false, error: { message: "Voting has ended." } } as never);
  await act(async () => buttonByText(container, /Free Talk/)!.click());
  expect(errorToast).toHaveBeenCalledWith("Voting has ended.");
});

it("locks the ballot offline", async () => {
  useLobbyStore.getState().setConnection("reconnecting");
  await renderPlayer(voteLobby({ kind: "player", playerId: "p0" }, vote()));
  expect(buttonByText(container, /Free Talk/)!.disabled).toBe(true);
});

it("shows the winner and locks the buttons once the vote has closed", async () => {
  const closed = vote({
    status: "CLOSED",
    winnerId: "free-talk",
    timer: { endsAt: null, pausedRemainingMs: null, durationMs: GAME_VOTE_DURATION_MS },
  });
  await renderPlayer(voteLobby({ kind: "player", playerId: "p0" }, closed));
  expect(container.textContent).toContain("Voting is over");
  expect(container.querySelector('[role="status"]')?.textContent).toContain("Free Talk");
  expect(buttonByText(container, /Secret Word/)!.disabled).toBe(true);
});

it("says nobody voted instead of naming a game when the vote closes empty", async () => {
  const closed = vote({
    status: "CLOSED",
    votedCount: 0,
    winnerId: null,
    options: vote().options.map((o) => ({ ...o, votes: 0 })),
    timer: { endsAt: null, pausedRemainingMs: null, durationMs: GAME_VOTE_DURATION_MS },
  });
  await renderPlayer(voteLobby({ kind: "player", playerId: "p0" }, closed));
  expect(container.querySelector('[role="status"]')?.textContent).toContain("Nobody voted");
});

it("does not interrupt a player whose group is playing", async () => {
  const lobby = spyLobby();
  lobby.viewer = { kind: "player", playerId: "p0" };
  lobby.me = { playerId: "p0", groupId: "g1", name: "Ada" };
  lobby.gameVote = vote();
  await renderPlayer(lobby);
  expect(container.textContent).not.toContain("Vote for the next game");
});

it("lets the host pick games, needs two, and opens the vote with the chosen ids", async () => {
  await renderHostGame(voteLobby({ kind: "host" }, null));
  const start = buttonByText(container, /Start vote \(60s\)/)!;
  expect(start.disabled).toBe(false);
  const switches = [...container.querySelectorAll('[role="switch"], input[type="checkbox"]')];
  expect(switches).toHaveLength(2);
  await act(async () => (switches[0] as HTMLElement).click());
  expect(buttonByText(container, /Start vote/)!.disabled).toBe(true);
  expect(container.textContent).toContain("Pick at least 2 games");
  await act(async () => (switches[0] as HTMLElement).click());
  await act(async () => buttonByText(container, /Start vote/)!.click());
  expect(hostCommand).toHaveBeenCalledWith("gameVote:start", {
    gameIds: ["whos-the-spy", "free-talk"],
  });
});

it("shows the host the live tally and lets them cancel a running vote", async () => {
  await renderHostGame(voteLobby({ kind: "host" }, vote()));
  expect(container.textContent).toContain("Vote is open");
  expect(container.textContent).toContain("3 of 4 voted");
  await act(async () => buttonByText(container, /Cancel vote/)!.click());
  expect(hostCommand).toHaveBeenCalledWith("gameVote:clear", {});
});

it("shows the host the winner and a way back to vote setup", async () => {
  const closed = vote({
    status: "CLOSED",
    winnerId: "secret-word",
    timer: { endsAt: null, pausedRemainingMs: null, durationMs: GAME_VOTE_DURATION_MS },
  });
  await renderHostGame(voteLobby({ kind: "host" }, closed));
  expect(container.textContent).toContain("Vote finished");
  expect(container.querySelector('[role="status"]')?.textContent).toContain("Secret Word");
  await act(async () => buttonByText(container, /Back to vote setup/)!.click());
  expect(hostCommand).toHaveBeenCalledWith("gameVote:clear", {});
});

it("keeps the vote reachable on the host's game tab after a game is chosen but not started", async () => {
  const lobby = voteLobby({ kind: "host" }, vote());
  lobby.game = { ...spyLobby().game!, stage: "CONFIGURING", groups: [], clock: null };
  await renderHostGame(lobby);
  expect(buttonByText(container, /Cancel vote/)).toBeDefined();
});

it("returns the host to vote setup, not an empty tab, after clearing while a game is chosen", async () => {
  const lobby = voteLobby({ kind: "host" }, null);
  lobby.game = { ...spyLobby().game!, stage: "CONFIGURING", groups: [], clock: null };
  await renderHostGame(lobby);
  expect(buttonByText(container, /Start vote \(60s\)/)).toBeDefined();
});

it("hides the vote panel once a game is playing", async () => {
  await renderHostGame({ ...spyLobby(), gameVote: null });
  expect(container.textContent).not.toContain("Let players vote");
});

it("shows the projector the countdown and live bars while voting", async () => {
  await renderDisplay(voteLobby({ kind: "projector" }, vote()));
  expect(container.textContent).toContain("Vote for the next game");
  expect(container.querySelector('[role="timer"]')).not.toBeNull();
  const bars = [...container.querySelectorAll(".gv-bar")].map((b) => b.textContent);
  expect(bars[0]).toContain("Free Talk");
  expect(bars[0]).toContain("2");
  expect(container.textContent).toContain("3 of 4 voted");
  expect(container.textContent).not.toContain("Look who");
});

it("announces the winning minigame on the projector when the vote closes", async () => {
  const closed = vote({
    status: "CLOSED",
    winnerId: "free-talk",
    timer: { endsAt: null, pausedRemainingMs: null, durationMs: GAME_VOTE_DURATION_MS },
  });
  await renderDisplay(voteLobby({ kind: "projector" }, closed));
  expect(container.querySelector(".gv-winner-large")?.textContent).toContain("Free Talk");
  expect(container.querySelector('[role="timer"]')).toBeNull();
});

it("returns the projector to the lobby once the host clears the vote", async () => {
  await renderDisplay(voteLobby({ kind: "projector" }, null));
  expect(container.textContent).not.toContain("Vote for the next game");
  expect(container.textContent).toContain("Look who");
});
