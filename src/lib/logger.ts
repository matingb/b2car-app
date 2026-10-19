import { telemetry, type TelemetryContext, sanitizeLogArgs } from "./telemetry";

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

export const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 50,
  info: 40,
  warn: 30,
  error: 20,
  none: 10,
};

export function getLogLevel(): LogLevel {
  const envLevel =
    process.env.LOG_LEVEL ??
    process.env['NEXT_PUBLIC_LOG_LEVEL'] ??
    'info';

  const normalized = envLevel.trim().toLowerCase() as LogLevel;
  return LEVEL_ORDER[normalized] !== undefined ? normalized : 'info';
}

export function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] <= LEVEL_ORDER[getLogLevel()];
}

function parseLogArgs(args: unknown[]): { error: Error; context: TelemetryContext; message: string } {
  const message = args.filter((a): a is string => typeof a === "string").join(" ");
  const errorArg = args.find((a): a is Error => a instanceof Error);
  const context: TelemetryContext = {};

  args.forEach((arg) => {
    if (arg instanceof Error || typeof arg === "string") return;
    if (arg && typeof arg === "object") Object.assign(context, arg);
  });

  return {
    error: errorArg ?? new Error(message || "Logger Error"),
    context,
    message: message || (errorArg ? errorArg.message : ""),
  };
}

type ActiveLogLevel = 'debug' | 'info' | 'warn' | 'error';

function emitLog(level: ActiveLogLevel, ...args: unknown[]): void {
  if (!shouldLog(level)) return;

  const sanitized = sanitizeLogArgs(args);
  const prefix = `[${level.toUpperCase()}]`;

  if (level === 'info') console.log(prefix, ...sanitized);
  else if (level === 'debug') console.debug(prefix, ...sanitized);
  else if (level === 'warn') console.warn(prefix, ...sanitized);
  else if (level === 'error') console.error(prefix, ...sanitized);

  try {
    const { error, context, message } = parseLogArgs(sanitized);
    if (level === 'error') {
      telemetry.recordException(error, context);
    }
    telemetry.log(level, message, context);
  } catch {}
}

export const logger = {
  debug: (...args: unknown[]) => emitLog('debug', ...args),
  info: (...args: unknown[]) => emitLog('info', ...args),
  warn: (...args: unknown[]) => emitLog('warn', ...args),
  error: (...args: unknown[]) => emitLog('error', ...args),
};

export type ScopedLogger = typeof logger;

export function createScopedLogger(scope: string): ScopedLogger {
  const prefix = `[${scope}]`;
  return {
    debug: (...args) => logger.debug(prefix, ...args),
    info: (...args) => logger.info(prefix, ...args),
    warn: (...args) => logger.warn(prefix, ...args),
    error: (...args) => logger.error(prefix, ...args),
  };
}
