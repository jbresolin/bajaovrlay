// Test support for the every-N-minutes trigger tests (BAJAOVRLAY-64): the seeded sponsors
// trigger as a test makes it, and the firing times read as the operator reads them. Shared
// by intervalTriggers.test.ts and intervalTriggersAndTheRoll.test.ts; nothing here keeps
// state between calls.
import { plainSponsorRollMacroId, readFirings } from './triggersOnTheStore.testSupport.js';

/** One minute, in milliseconds. */
export const oneMinuteMs = 60_000;

/** A moment of race day in São Paulo, "HH:MM", as ms since 1970 (UTC is 3 h ahead). */
export function momentOfRaceDayAt(timeOfDay: string): number {
  return Date.parse(`2027-08-14T${timeOfDay}:00.000-03:00`);
}

/** "Patrocinadores a cada N min", asking first unless the test says auto. */
export function buildSponsorsEveryMinutesTrigger(
  everyMinutes: number,
  changes: Record<string, unknown> = {},
) {
  return {
    name: `Patrocinadores a cada ${String(everyMinutes)} min`,
    when: { kind: 'schedule', moment: { kind: 'everyMinutes', everyMinutes, window: null } },
    macroId: plainSponsorRollMacroId,
    mode: 'ask',
    ...changes,
  };
}

/** When each firing of the list came, as "HH:MM" in São Paulo. */
export function readFiringTimesOfDay(store: Parameters<typeof readFirings>[0]): string[] {
  return readFirings(store).map((firing) =>
    new Date(firing.firedAtMs).toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }),
  );
}
