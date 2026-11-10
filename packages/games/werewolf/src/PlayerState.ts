import type { Role } from "./types.js";

/** One player's server-side game state. */
export interface PlayerState {
  role: Role;
  alive: boolean;
  /** True for a late joiner who enters play at the next dawn; they cannot act or vote yet. */
  pending: boolean;
}
