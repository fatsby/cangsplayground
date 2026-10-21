import { create } from "zustand";
import { applyPatch, type LobbyPatch, type LobbyView } from "@clubplay/core";
export type Connection = "connecting" | "online" | "reconnecting";
export type TerminalStatus = "closed" | "kicked" | null;
export interface LobbyStore {
  view: LobbyView | null;
  connection: Connection;
  offset: number;
  terminal: TerminalStatus;
  disconnectedAt: number | null;
  serverNow: () => number;
  sync: (view: LobbyView) => void;
  patch: (patch: LobbyPatch) => void;
  setOffset: (offset: number) => void;
  setConnection: (connection: Connection) => void;
  finish: (terminal: TerminalStatus) => void;
  reset: () => void;
}
export function createLobbyStore() {
  return create<LobbyStore>((set, get) => ({
    view: null,
    connection: "connecting",
    offset: 0,
    terminal: null,
    disconnectedAt: null,
    serverNow: () => Date.now() + get().offset,
    sync: (view) => set({ view, terminal: null }),
    patch: (patch) =>
      set((state) =>
        state.view && patch.version > state.view.version
          ? { view: applyPatch(state.view, patch) }
          : {},
      ),
    setOffset: (offset) => set({ offset }),
    setConnection: (connection) =>
      set((state) => ({
        connection,
        disconnectedAt: connection === "online" ? null : (state.disconnectedAt ?? Date.now()),
      })),
    finish: (terminal) => set({ terminal, view: null }),
    reset: () => set({ view: null, terminal: null }),
  }));
}
export const useLobbyStore = createLobbyStore();
