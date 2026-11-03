import { type ReactNode, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildErrorAttributesForControl, FormFieldRow } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';

import type { BajaAppTableChoice, BajaAppTournamentChoice } from './bajaAppAnswerReading';
import { findProblemOfTypedResultadoId } from './bajaAppTypedIds';

const texts = ptBR.dataSources.bajaApp;

/** A result typed by its id, as the picker holds it while and after reading it. */
export type OtherResultState =
  | { phase: 'notRead' }
  | { phase: 'reading' }
  | { phase: 'failed'; reason: string }
  | { phase: 'table'; table: BajaAppTableChoice }
  | { phase: 'tournament'; tournament: BajaAppTournamentChoice };

/** What the picker gives the option. */
export type BajaAppOtherResultOptionProps = {
  /** The event read: an id must be of this event ("26BR_…"). */
  eventId: string;
  otherResult: OtherResultState;
  /** Called with an id that passed the check; the picker reads it. */
  onRead: (resultadoId: string) => void;
  /** The table's own options (its points and parts), drawn once a table is read. */
  tableOptions: ReactNode;
};

/**
 * Under "Outro resultado (digite o id)" (gate 2 of PR #38): the id of a result the event's
 * menu leaves out, checked against the API's pattern before anything is read, "Ler
 * resultado", and what it turned out to be: a table (with its options) or a tournament.
 */
export function BajaAppOtherResultOption(props: BajaAppOtherResultOptionProps) {
  const resultadoIdControlId = useId();
  const [resultadoId, setResultadoId] = useState('');
  const [resultadoIdProblem, setResultadoIdProblem] = useState<string | undefined>(undefined);
  const { otherResult } = props;

  function readTheResult(): void {
    const problem = findProblemOfTypedResultadoId(resultadoId, props.eventId);
    setResultadoIdProblem(problem);
    if (problem === undefined) {
      props.onRead(resultadoId.trim());
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <FormFieldRow
          label={texts.resultadoIdLabel}
          controlId={resultadoIdControlId}
          errorMessage={resultadoIdProblem}
        >
          <Input
            id={resultadoIdControlId}
            value={resultadoId}
            placeholder={texts.resultadoIdHint(props.eventId)}
            onChange={(event) => setResultadoId(event.target.value)}
            {...buildErrorAttributesForControl(resultadoIdControlId, resultadoIdProblem)}
          />
        </FormFieldRow>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={otherResult.phase === 'reading'}
          onClick={readTheResult}
        >
          {otherResult.phase === 'reading' ? texts.readingResult : texts.readResultButton}
        </Button>
      </div>
      {otherResult.phase === 'failed' && (
        <p role="alert" className="text-sm text-destructive">
          {otherResult.reason}
        </p>
      )}
      {otherResult.phase === 'tournament' && (
        <p className="text-sm">{texts.otherResultIsATournament(otherResult.tournament.name)}</p>
      )}
      {otherResult.phase === 'table' && (
        <>
          <p className="text-sm">{texts.otherResultIsATable(otherResult.table.name)}</p>
          {props.tableOptions}
        </>
      )}
    </div>
  );
}
