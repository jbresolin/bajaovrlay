import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.dataSources.bajaApp;

/** A chosen table's columns, as the picker holds them while and after reading them. */
export type TableColumnsState =
  | { phase: 'reading'; resultadoId: string }
  | { phase: 'failed'; resultadoId: string; reason: string }
  | {
      phase: 'read';
      resultadoId: string;
      pointsHeader: string;
      partHeaderChoices: string[];
      tickedPartHeaders: string[];
    };

/**
 * Under a chosen race: "Aceitar corrida simulada", off unless ticked, since a simulated
 * race must not reach air as a real one; ticked, for tests and rehearsals.
 */
export function BajaAppRaceOptions(props: {
  acceptsSimulatedRace: boolean;
  onChange: (acceptsSimulatedRace: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={props.acceptsSimulatedRace}
          onChange={(event) => props.onChange(event.target.checked)}
        />
        <span>{texts.acceptSimulatedRace}</span>
      </label>
      <p className="text-xs text-muted-foreground">{texts.acceptSimulatedRaceHint}</p>
    </div>
  );
}

/**
 * Under a chosen table: its columns being read, the reason they could not be, or the
 * column it ranks by (the points) and a box per column that may be a part of the score,
 * the overall table's parts ticked to start with.
 */
export function BajaAppTableOptions(props: {
  columns: TableColumnsState;
  onTickedPartHeadersChange: (tickedPartHeaders: string[]) => void;
}) {
  const { columns } = props;
  if (columns.phase === 'reading') {
    return <p className="text-sm text-muted-foreground">{texts.readingTable}</p>;
  }
  if (columns.phase === 'failed') {
    return (
      <p role="alert" className="text-sm text-destructive">
        {columns.reason}
      </p>
    );
  }

  function tickOrUntick(header: string, isTicked: boolean): void {
    if (columns.phase !== 'read') {
      return;
    }
    // Kept in the table's order whatever order they are ticked in: that is the parts' order.
    const ticked = columns.partHeaderChoices.filter((choice) =>
      choice === header ? isTicked : columns.tickedPartHeaders.includes(choice),
    );
    props.onTickedPartHeadersChange(ticked);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">{texts.pointsColumn(columns.pointsHeader)}</p>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">{texts.partsTitle}</legend>
        <p className="text-xs text-muted-foreground">{texts.partsHint}</p>
        {columns.partHeaderChoices.map((header) => (
          <label key={header} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              aria-label={header}
              className="size-4 accent-primary"
              checked={columns.tickedPartHeaders.includes(header)}
              onChange={(event) => tickOrUntick(header, event.target.checked)}
            />
            <span>{header}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
