import { randomBytes, randomUUID } from "node:crypto";
export const newToken = () => randomBytes(24).toString("base64url");
export const newPlayerId = () => randomUUID().replaceAll("-", "").slice(0, 10);
