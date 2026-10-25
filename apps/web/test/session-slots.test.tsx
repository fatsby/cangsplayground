// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GroupGameView } from "@cangsplayground/core";
import type { GameViews } from "@cangsplayground/ui";
import { HostGame } from "../src/components/HostGame";
import { gameViews } from "../src/games/registry";
import { projectorBody } from "../src/routes/Display";
import Host from "../src/routes/Host";
import Player from "../src/routes/Player";
import { useLobbyStore } from "../src/store";
import { spyLobby } from "./spy-ux-fixture";

const { hostCommand, request, useWakeLock } = vi.hoisted(() => ({
  hostCommand: vi.fn(async () => ({ ok: true })),
  request: vi.fn(async () => ({ ok: true })),
  useWakeLock: vi.fn(),
}));
vi.mock("../src/socket", () => ({ readToken: () => "session-token", hostCommand, request }));
vi.mock("../src/components/MobileToaster", () => ({ MobileToaster: () => null }));
vi.mock("../src/components/session", () => ({
  useRole: () => "",
  useWakeLock,
  SessionBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

const sessionViews: GameViews = {
  ProjectorScreen: () => <p>projector-slot</p>,
  HostSessionPanel: ({ busy, hostAct }) => (
    <>
      <p>host-slot</p>
      <button disabled={busy} onClick={() => void hostAct?.({ type: "session:next" })}>
        Session next
      </button>
    </>
  ),
  PlayerSessionScreen: ({ act, me }) => (
    <>
      <p>player-slot for {me.name}</p>
      <button onClick={() => void act?.({ type: "session:vote", payload: 2 })}>Session vote</button>
    </>
  ),
  PlayerScreen: () => <p>group-slot</p>,
};

function sessionLobby(phase: GroupGameView["phase"] = "PREPARED") {
  const lobby = spyLobby(phase);
  lobby.game = { ...lobby.game!, gameId: "test-session", clock: null, shared: { stage: "PREP" } };
  lobby.catalog = [{ ...lobby.catalog[0]!, id: "test-session", configFields: [] }];
  return lobby;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  hostCommand.mockClear();
  request.mockClear();
  useWakeLock.mockClear();
  gameViews["test-session"] = sessionViews;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  useLobbyStore.getState().setConnection("online");
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete gameViews["test-session"];
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

function hostMarkup(lobby = sessionLobby(), busy = false) {
  return renderToStaticMarkup(
    <HostGame
      view={lobby}
      busy={busy}
      serverNow={() => 0}
      select={() => {}}
      configure={async () => true}
      control={() => {}}
    />,
  );
}

async function renderRoute(role: "host" | "play", lobby = sessionLobby()) {
  if (role === "play") {
    lobby.viewer = { kind: "player", playerId: "p0" };
    lobby.me = { playerId: "p0", groupId: "g1", name: "Ada" };
  }
  useLobbyStore.getState().sync(lobby);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[`/${role}/ABC234`]}>
        <Routes>
          <Route path={`/${role}/:code`} element={role === "host" ? <Host /> : <Player />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}

it("HostGame replaces group controls with the active session slot and keeps settings and Exit", () => {
  const html = hostMarkup();
  expect(html).toContain("host-slot");
  expect(html).not.toContain("All groups");
  expect(html).not.toContain(">Start<");
  expect(html).not.toContain("host-control-grid");
  expect(html).toContain("Game settings");
  expect(html).toContain("Exit game");
});

it("HostGame does not render the session slot while configuring", () => {
  const lobby = sessionLobby();
  lobby.game!.stage = "CONFIGURING";
  expect(hostMarkup(lobby)).not.toContain("host-slot");
});

it("Who's the Spy keeps the All groups panel", () => {
  expect(hostMarkup(spyLobby())).toContain("All groups");
});

it("Host hides the fixed core controls for an active session game", async () => {
  await renderRoute("host");
  expect(container.querySelector(".host-fixed-controls")).toBeNull();
});

it("Host keeps Prepare in the fixed bar while configuring a session game", async () => {
  const lobby = sessionLobby();
  lobby.game!.stage = "CONFIGURING";
  await renderRoute("host", lobby);
  expect(container.querySelector(".host-fixed-controls")?.textContent).toContain("Prepare");
});

it("Host sends session actions through hostCommand and passes busy to the slot", async () => {
  let resolve!: (value: { ok: boolean }) => void;
  hostCommand.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await renderRoute("host");
  const gameTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (b) => b.textContent === "Game",
  )!;
  await act(async () =>
    gameTab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })),
  );
  const next = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Session next",
  )!;
  expect(next).toBeDefined();
  await act(async () => next.click());
  expect(hostCommand).toHaveBeenCalledWith("game:hostAction", { type: "session:next" });
  expect(next.disabled).toBe(true);
  await act(async () => resolve({ ok: true }));
  expect(next.disabled).toBe(false);
});

it.each(["PREPARED", "RUNNING"] as const)(
  "Player uses its session screen during %s instead of group or turn UI",
  async (phase) => {
    await renderRoute("play", sessionLobby(phase));
    expect(container.querySelector(".player-game")?.textContent).toContain("player-slot for Ada");
    expect(container.textContent).not.toContain("Get ready");
    expect(container.textContent).not.toContain("group-slot");
    expect(container.textContent).not.toContain("I'm done");
    expect(useWakeLock).toHaveBeenLastCalledWith(true);
  },
);

it("Player renders the session slot even without a per-group runtime", async () => {
  const lobby = sessionLobby();
  lobby.game!.groups = [];
  await renderRoute("play", lobby);
  expect(container.textContent).toContain("player-slot");
});

it("Player forwards session actions through the player request", async () => {
  await renderRoute("play");
  const vote = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Session vote",
  )!;
  expect(vote).toBeDefined();
  await act(async () => vote.click());
  expect(request).toHaveBeenCalledWith("game:action", { type: "session:vote", payload: 2 });
});

it("Player waits for Prepare before rendering a session screen", async () => {
  const lobby = sessionLobby();
  lobby.game!.stage = "CONFIGURING";
  await renderRoute("play", lobby);
  expect(container.textContent).not.toContain("player-slot");
  expect(container.textContent).toContain("Find your team");
  expect(useWakeLock).toHaveBeenLastCalledWith(false);
});

it("projectorBody selects the session screen only while active", () => {
  const lobby = sessionLobby();
  const Screen = projectorBody(lobby.game, sessionViews)!;
  expect(
    renderToStaticMarkup(<Screen lobby={lobby} session={lobby.game!} serverNow={() => 0} />),
  ).toContain("projector-slot");
  lobby.game!.stage = "CONFIGURING";
  expect(projectorBody(lobby.game, sessionViews)).toBeNull();
  expect(projectorBody(null, sessionViews)).toBeNull();
  expect(projectorBody(sessionLobby().game, gameViews["whos-the-spy"])).toBeNull();
  expect(projectorBody(sessionLobby().game, undefined)).toBeNull();
});
