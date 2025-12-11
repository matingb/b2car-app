// src/lib/logger.ts
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
    process.env.NEXT_PUBLIC_LOG_LEVEL ??
    'none';

  const normalized = envLevel.toLowerCase() as LogLevel;
  return LEVEL_ORDER[normalized] ? normalized : 'none';
}

const CURRENT_LEVEL = getLogLevel();

function shouldLog(level: LogLevel) {
  return LEVEL_ORDER[level] <= LEVEL_ORDER[CURRENT_LEVEL];
}

// Helpers concretos
export const logger = {
  debug: (...args: any[]) => {
    if (shouldLog('debug')) console.debug('[DEBUG]', ...args);
  },
  info: (...args: any[]) => {
    if (shouldLog('info')) console.info('[INFO]', ...args);
  },
  warn: (...args: any[]) => {
    if (shouldLog('warn')) console.warn('[WARN]', ...args);
  },
  error: (...args: any[]) => {
    if (shouldLog('error')) console.error('[ERROR]', ...args);
  },
};
