// The circuit's time zone: every Baja SAE Brasil event so far has run on Brasília time,
// which is what the operator's watch says, whatever clock the server's container runs on.
export const timeZoneOfTheEvent = 'America/Sao_Paulo';

// en-CA writes dates as 2026-11-14, so the parts below come out with their zeros; only
// the parts are read, never the formatted text as a whole.
const partsOfTheLocalMoment = new Intl.DateTimeFormat('en-CA', {
  timeZone: timeZoneOfTheEvent,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * The name the browser saves a backup made at `moment` under, in São Paulo's time:
 * bajaovrlay-2026-11-14-1432.zip. No colon, which Windows refuses in a file name.
 */
export function nameBackupZipFile(moment: Date): string {
  const parts = partsOfTheLocalMoment.formatToParts(moment);
  const readPart = (partType: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === partType)?.value ?? '00';
  const date = `${readPart('year')}-${readPart('month')}-${readPart('day')}`;
  const time = `${readPart('hour')}${readPart('minute')}`;
  return `bajaovrlay-${date}-${time}.zip`;
}
