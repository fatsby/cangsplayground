import type { Ack, ErrorCode } from "@cangsplayground/core";
export class CommandError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public suggestion?: string,
  ) {
    super(message);
  }
}
export function failure(error: unknown): Ack<never> {
  return {
    ok: false,
    error:
      error instanceof CommandError
        ? {
            code: error.code,
            message: error.message,
            ...(error.suggestion ? { suggestion: error.suggestion } : {}),
          }
        : { code: "INVALID_STATE", message: "This action is not ready. Try again." },
  };
}
export function fail(code: ErrorCode, message: string): never {
  throw new CommandError(code, message);
}
