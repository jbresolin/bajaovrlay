import { bajaAppApiAddress, proposedScorePartHeaders } from '@bajaovrlay/shared';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { buildErrorAttributesForControl, FormFieldRow } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';

import { fetchHttpJsonSample } from '../flexSource/fetchHttpJsonSample';
import type { FlexSourceStartingPoint } from '../flexSource/flexSourceFormValues';
import {
  type BajaAppEventChoices as EventChoices,
  readBajaAppEventAnswer,
  readBajaAppTableColumns,
} from './bajaAppAnswerReading';
import {
  BajaAppRaceOptions,
  BajaAppTableOptions,
  type TableColumnsState,
} from './BajaAppChoiceOptions';
import { type BajaAppChoiceKey, BajaAppEventChoices } from './BajaAppEventChoices';
import { buildBajaAppEventRequest, buildBajaAppTableRequest } from './bajaAppSampleRequests';
import {
  type BajaAppChoice,
  type BajaAppEventAddress,
  buildBajaAppSourceOfChoice,
} from './bajaAppSourceOfChoice';

const texts = ptBR.dataSources.bajaApp;

/** The event as the picker holds it: not read yet, being read, refused, or read. */
type EventReadingState =
  | { phase: 'notRead' }
  | { phase: 'reading' }
  | { phase: 'failed'; reason: string }
  | { phase: 'read'; where: BajaAppEventAddress; event: EventChoices };

/** What the page gives the picker. */
export type BajaAppSourcePickerProps = {
  /** Called with the chosen preset filled in: the page opens the flex form with it. */
  onContinue: (startingPoint: FlexSourceStartingPoint) => void;
  onClose: () => void;
};

/**
 * "Adicionar fonte do app Baja" (BAJAOVRLAY-54): the operator types the event id (and,
 * only for a local copy, the API's address), the page reads the event through the
 * server's sample route and lists what it offers (BajaAppEventChoices.tsx). A race may
 * accept a simulation; a table is read too, for its points column and its parts.
 * "Continuar" hands the chosen preset, filled in, to the page, which opens the ordinary
 * flex form with it: nothing is saved here.
 */
export function BajaAppSourcePicker(props: BajaAppSourcePickerProps) {
  const idPrefix = useId();
  const ids = { apiAddress: `${idPrefix}-endereco`, eventId: `${idPrefix}-evento` };
  const [apiAddress, setApiAddress] = useState(bajaAppApiAddress);
  const [eventId, setEventId] = useState('');
  const [typingProblem, setTypingProblem] = useState<string | undefined>(undefined);
  const [eventReading, setEventReading] = useState<EventReadingState>({ phase: 'notRead' });
  const [chosenKey, setChosenKey] = useState<BajaAppChoiceKey | null>(null);
  const [acceptsSimulatedRace, setAcceptsSimulatedRace] = useState(false);
  const [tableColumns, setTableColumns] = useState<TableColumnsState | null>(null);

  async function readTheEvent(): Promise<void> {
    const where = { apiAddress: apiAddress.trim(), eventId: eventId.trim() };
    if (where.eventId === '') {
      setTypingProblem(texts.noEventId);
      return;
    }
    if (!/^https?:\/\//.test(where.apiAddress)) {
      setTypingProblem(texts.apiAddressNotHttp);
      return;
    }
    setTypingProblem(undefined);
    setChosenKey(null);
    setTableColumns(null);
    setEventReading({ phase: 'reading' });
    const answer = await fetchHttpJsonSample(
      buildBajaAppEventRequest(where.apiAddress, where.eventId),
    );
    if (!answer.ok) {
      setEventReading({ phase: 'failed', reason: answer.error });
      return;
    }
    const reading = readBajaAppEventAnswer(answer.body);
    setEventReading(
      reading.isRead
        ? { phase: 'read', where, event: reading.event }
        : { phase: 'failed', reason: reading.reason },
    );
  }

  async function readTheColumnsOfTable(where: BajaAppEventAddress, resultadoId: string) {
    setTableColumns({ phase: 'reading', resultadoId });
    const request = buildBajaAppTableRequest(where.apiAddress, where.eventId, resultadoId);
    const answer = await fetchHttpJsonSample(request);
    const reading = answer.ok
      ? readBajaAppTableColumns(answer.body)
      : { isRead: false as const, reason: answer.error };
    const columnsRead: TableColumnsState = reading.isRead
      ? {
          phase: 'read',
          resultadoId,
          pointsHeader: reading.pointsHeader,
          partHeaderChoices: reading.partHeaderChoices,
          tickedPartHeaders: reading.partHeaderChoices.filter((header) =>
            proposedScorePartHeaders.includes(header),
          ),
        }
      : { phase: 'failed', resultadoId, reason: reading.reason };
    // A table the operator left meanwhile for another choice is not shown.
    setTableColumns((current) => (current?.resultadoId === resultadoId ? columnsRead : current));
  }

  function choose(choiceKey: BajaAppChoiceKey): void {
    setChosenKey(choiceKey);
    setTableColumns(null);
    if (eventReading.phase === 'read' && choiceKey.startsWith('table:')) {
      void readTheColumnsOfTable(eventReading.where, choiceKey.slice('table:'.length));
    }
  }

  const choice = eventReading.phase === 'read' ? buildChoice(eventReading.event) : undefined;

  /** The choice made, with its options, once it has all it needs; undefined until then. */
  function buildChoice(event: EventChoices): BajaAppChoice | undefined {
    const race = event.races.find((candidate) => `race:${candidate.provaId}` === chosenKey);
    if (race !== undefined) {
      return { kind: 'race', race, acceptsSimulatedRace };
    }
    const tournament = event.tournaments.find(
      (candidate) => `tournament:${candidate.resultadoId}` === chosenKey,
    );
    if (tournament !== undefined) {
      return { kind: 'tournament', tournament };
    }
    const table = event.tables.find((candidate) => `table:${candidate.resultadoId}` === chosenKey);
    if (table === undefined || tableColumns?.phase !== 'read') {
      return undefined;
    }
    return {
      kind: 'table',
      table,
      pointsHeader: tableColumns.pointsHeader,
      partHeaders: tableColumns.tickedPartHeaders,
    };
  }

  function continueWithTheChoice(): void {
    if (eventReading.phase === 'read' && choice !== undefined) {
      props.onContinue(buildBajaAppSourceOfChoice(eventReading.where, choice));
    }
  }

  /** The chosen entry's own options: the race's box, or the table's columns; else none. */
  function drawOptionsOfTheChoice() {
    if (chosenKey?.startsWith('race:') === true) {
      return (
        <BajaAppRaceOptions
          acceptsSimulatedRace={acceptsSimulatedRace}
          onChange={setAcceptsSimulatedRace}
        />
      );
    }
    if (tableColumns === null) {
      return null;
    }
    return (
      <BajaAppTableOptions
        columns={tableColumns}
        onTickedPartHeadersChange={(tickedPartHeaders) =>
          setTableColumns((current) =>
            current?.phase === 'read' ? { ...current, tickedPartHeaders } : current,
          )
        }
      />
    );
  }

  return (
    <section aria-label={texts.pickerTitle}>
      <Card>
        <CardHeader>
          <CardTitle>
            <h3>{texts.pickerTitle}</h3>
          </CardTitle>
        </CardHeader>
        <form noValidate onSubmit={(event) => event.preventDefault()}>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
              <FormFieldRow
                label={texts.apiAddressLabel}
                controlId={ids.apiAddress}
                errorMessage={undefined}
              >
                <Input
                  id={ids.apiAddress}
                  value={apiAddress}
                  onChange={(event) => setApiAddress(event.target.value)}
                />
              </FormFieldRow>
              <FormFieldRow
                label={texts.eventIdLabel}
                controlId={ids.eventId}
                errorMessage={typingProblem}
              >
                <Input
                  id={ids.eventId}
                  value={eventId}
                  placeholder={texts.eventIdHint}
                  onChange={(event) => setEventId(event.target.value)}
                  {...buildErrorAttributesForControl(ids.eventId, typingProblem)}
                />
              </FormFieldRow>
              <Button
                type="button"
                variant="outline"
                disabled={eventReading.phase === 'reading'}
                onClick={() => void readTheEvent()}
              >
                {eventReading.phase === 'reading' ? texts.readingEvent : texts.readEventButton}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{texts.apiAddressHint}</p>
            {eventReading.phase === 'failed' && (
              <p role="alert" className="text-sm text-destructive">
                {eventReading.reason}
              </p>
            )}
            {eventReading.phase === 'read' && (
              <BajaAppEventChoices
                event={eventReading.event}
                chosenKey={chosenKey}
                onChoose={choose}
                optionsOfTheChoice={drawOptionsOfTheChoice()}
              />
            )}
          </CardContent>
          <CardFooter className="mt-4 gap-2">
            <Button type="button" disabled={choice === undefined} onClick={continueWithTheChoice}>
              {texts.continueButton}
            </Button>
            <Button type="button" variant="ghost" onClick={props.onClose}>
              {texts.cancelButton}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
