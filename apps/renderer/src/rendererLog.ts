/** How serious a renderer log line is; the same words the server's logger uses. */
export type RendererLogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Writes one structured JSON line to the browser console: level, message, ISO time and
 * any details. Inside OBS the console is the only log there is, so lines are JSON to be
 * searchable like the server's. `now` is a parameter so tests can fix the clock.
 */
export function logRendererEvent(
  level: RendererLogLevel,
  message: string,
  details: Record<string, unknown> = {},
  now: Date = new Date(),
): void {
  const logLine = JSON.stringify({ level, message, time: now.toISOString(), ...details });
  // The renderer has no server-side logger to write to; the console is how OBS and
  // remote DevTools see renderer logs. This is the only console call in the renderer.
  // eslint-disable-next-line no-console
  console.info(logLine);
}
