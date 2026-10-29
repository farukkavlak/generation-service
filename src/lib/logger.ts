export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

type Level = 'info' | 'error';

export const consoleLogger: Logger = {
  info(message, context) {
    console.log(toJsonLine('info', message, context));
  },
  error(message, context) {
    console.error(toJsonLine('error', message, context));
  },
};

function toJsonLine(level: Level, message: string, context: Record<string, unknown> = {}): string {
  return JSON.stringify(
    { ...context, time: new Date().toISOString(), level, message },
    serializeError,
  );
}

// JSON.stringify drops Error fields; keep own fields like `code` too, as connection errors have no message.
function serializeError(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return Object.assign({}, value, {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: value.cause,
      errors: value instanceof AggregateError ? (value.errors as unknown[]) : undefined,
    });
  }
  return value;
}
