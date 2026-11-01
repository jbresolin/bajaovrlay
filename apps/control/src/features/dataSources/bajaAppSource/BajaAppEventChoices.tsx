import type { ReactNode } from 'react';

import { ptBR } from '@/i18n/ptBR';

import type { BajaAppEventChoices as EventChoices } from './bajaAppAnswerReading';

const texts = ptBR.dataSources.bajaApp;

/** The key of one choice across the three lists: "race:END", "table:26BR_GER"… */
export type BajaAppChoiceKey = `race:${string}` | `table:${string}` | `tournament:${string}`;

/** What the lists need: the event read, the choice made, and where a choice goes. */
export type BajaAppEventChoicesProps = {
  event: EventChoices;
  chosenKey: BajaAppChoiceKey | null;
  onChoose: (choiceKey: BajaAppChoiceKey) => void;
  /** Drawn under the chosen entry: the race's or the table's own options. */
  optionsOfTheChoice: ReactNode;
};

/** One entry of a list, for the radio buttons. */
type ListedChoice = { choiceKey: BajaAppChoiceKey; name: string };

/**
 * The three lists of an event read on "Adicionar fonte do app Baja": its lap-counted
 * races, its results tables and its tournaments, by the API's own names, each a group of
 * radio buttons sharing one choice. An empty list says so in words. The chosen entry's
 * options (the simulated race box, a table's parts) are drawn right under it.
 */
export function BajaAppEventChoices(props: BajaAppEventChoicesProps) {
  const races = props.event.races.map((race) => ({
    choiceKey: `race:${race.provaId}` as const,
    name: race.name,
  }));
  const tables = props.event.tables.map((table) => ({
    choiceKey: `table:${table.resultadoId}` as const,
    name: table.name,
  }));
  const tournaments = props.event.tournaments.map((tournament) => ({
    choiceKey: `tournament:${tournament.resultadoId}` as const,
    name: tournament.name,
  }));

  return (
    <div className="flex flex-col gap-4">
      <p className="font-medium">{props.event.eventName}</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChoiceList
          title={texts.racesTitle}
          hint={texts.racesHint}
          emptyText={texts.noRaces}
          choices={races}
          {...props}
        />
        <ChoiceList
          title={texts.tablesTitle}
          hint={texts.tablesHint}
          emptyText={texts.noTables}
          choices={tables}
          {...props}
        />
        <ChoiceList
          title={texts.tournamentsTitle}
          hint={texts.tournamentsHint}
          emptyText={texts.noTournaments}
          choices={tournaments}
          {...props}
        />
      </div>
    </div>
  );
}

/** One list as a fieldset of radio buttons, or its sentence when it is empty. */
function ChoiceList(
  props: BajaAppEventChoicesProps & {
    title: string;
    hint: string;
    emptyText: string;
    choices: ListedChoice[];
  },
) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-semibold">{props.title}</legend>
      <p className="text-xs text-muted-foreground">{props.hint}</p>
      {props.choices.length === 0 && (
        <p className="text-sm text-muted-foreground">{props.emptyText}</p>
      )}
      {props.choices.map((choice) => {
        const isChosen = choice.choiceKey === props.chosenKey;
        return (
          <div key={choice.choiceKey} className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="escolha-do-app-baja"
                aria-label={choice.name}
                className="size-4 accent-primary"
                checked={isChosen}
                onChange={() => props.onChoose(choice.choiceKey)}
              />
              <span>{choice.name}</span>
            </label>
            {isChosen && <div className="ml-6">{props.optionsOfTheChoice}</div>}
          </div>
        );
      })}
    </fieldset>
  );
}
