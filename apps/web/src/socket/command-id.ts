// crypto.randomUUID only exists in secure contexts; phones reach the host console over plain-http LAN.
export function newCommandId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
