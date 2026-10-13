import { telemetry, type TelemetryContext } from "./telemetry";

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 50,
  info: 40,
  warn: 30,
  error: 20,
  none: 10,
};

function getLogLevel(): LogLevel {
  const envLevel =
    process.env.LOG_LEVEL ??
    process.env['NEXT_PUBLIC_LOG_LEVEL'] ??
    'info';

  const normalized = envLevel.toLowerCase() as LogLevel;
  return LEVEL_ORDER[normalized] ? normalized : 'info';
}

const CURRENT_LEVEL = getLogLevel();

function shouldLog(level: LogLevel) {
  return LEVEL_ORDER[level] <= LEVEL_ORDER[CURRENT_LEVEL];
}

function parseLogArgs(args: unknown[]): { error: Error; context: TelemetryContext } {
  const message = args.filter((a): a is string => typeof a === "string").join(" ");
  const errorArg = args.find((a): a is Error => a instanceof Error);
  const context: TelemetryContext = {};

  args.forEach((arg, idx) => {
    if (arg instanceof Error || typeof arg === "string") return;
    if (arg && typeof arg === "object") Object.assign(context, arg);
    else context[`arg_${idx}`] = arg;
  });

  if (errorArg && message) context.log_message = message;

  return { error: errorArg ?? new Error(message || "Logger Error"), context };
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) console.debug('[DEBUG]', ...args);
  },
  info: (...args: unknown[]) => {
    if (shouldLog('info')) console.log('[INFO]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) console.warn('[WARN]', ...args);
  },
  error: (...args: unknown[]) => {
    if (shouldLog('error')) console.error('[ERROR]', ...args);
    try {
      const { error, context } = parseLogArgs(args);
      telemetry.recordException(error, context);
    } catch {
    }
  },
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
