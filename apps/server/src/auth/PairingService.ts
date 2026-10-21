import { newToken } from "./tokens.js";
import { fail } from "./errors.js";
export class PairingService {
  private pairs = new Map<string, { code: string; expiresAt: number }>();
  constructor(private now: () => number = Date.now) {}
  create(code: string) {
    this.clearLobby(code);
    const pairToken = newToken(),
      expiresAt = this.now() + 120000;
    this.pairs.set(pairToken, { code, expiresAt });
    return { pairToken, expiresAt };
  }
  claim(code: string, token: string) {
    const pair = this.pairs.get(token);
    if (!pair || pair.code !== code || pair.expiresAt <= this.now())
      fail("PAIR_EXPIRED", "This host QR has expired. Scan a new QR.");
    this.pairs.delete(token);
  }
  clearLobby(code: string) {
    for (const [token, pair] of this.pairs) if (pair.code === code) this.pairs.delete(token);
  }
  sweep() {
    for (const [token, pair] of this.pairs)
      if (pair.expiresAt <= this.now()) this.pairs.delete(token);
  }
}
