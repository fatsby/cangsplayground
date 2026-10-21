import type { Rng } from "./rng.js";

/** LOB-01: uppercase letters + digits without look-alikes (0/O, 1/I/L). */
export const LOBBY_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const LOBBY_CODE_LENGTH = 6;

const CODE_RE = new RegExp(`^[${LOBBY_CODE_ALPHABET}]{${LOBBY_CODE_LENGTH}}$`);

export function generateLobbyCode(rng: Rng): string {
  let code = "";
  for (let i = 0; i < LOBBY_CODE_LENGTH; i++) {
    code += LOBBY_CODE_ALPHABET[rng.int(LOBBY_CODE_ALPHABET.length)];
  }
  return code;
}

/** Uppercases and trims user input; does not validate. */
export function normalizeLobbyCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidLobbyCode(code: string): boolean {
  return CODE_RE.test(code);
}
