/** Small promises + errors helpers used across the main process. */
export class AppError extends Error {
  readonly code: string;
  readonly userMessage: string;
  constructor(code: string, message: string, userMessage?: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.userMessage = userMessage ?? message;
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

export function toUserMessage(err: unknown): string {
  if (err instanceof AppError) return err.userMessage;
  return errorMessage(err);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
