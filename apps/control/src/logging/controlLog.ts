/** How serious a control page log line is; the same words the server's logger uses. */
export type ControlLogLevel = 'error' | 'warn' | 'info' | 'debug';

/** The shape of the log function, so code that logs can be handed a stand-in in tests. */
export type LogControlEvent = (
  level: ControlLogLevel,
  message: string,
  details?: Record<string, unknown>,
) => void;

/**
 * Writes one structured JSON line to the browser console: level, message, ISO time and
 * any details. Lines are JSON so they can be searched like the server's and the
 * renderer's. `now` is a parameter so tests can fix the clock.
 */
export function logControlEvent(
  level: ControlLogLevel,
  message: string,
  details: Record<string, unknown> = {},
  now: Date = new Date(),
): void {
  const logLine = JSON.stringify({ level, message, time: now.toISOString(), ...details });
  // The control page has no server-side logger to write to; DevTools' console is where
  // a developer reads these. This is the only console call on the control page.
  // eslint-disable-next-line no-console
  console.info(logLine);
}
