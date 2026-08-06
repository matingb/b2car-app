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
  },
};
