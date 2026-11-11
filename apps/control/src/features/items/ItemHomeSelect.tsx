import type { ItemHome, QuickFirePanel, Rundown } from '@bajaovrlay/shared';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import { FormFieldRow } from './FormFieldRow';

/** What the dropdown needs: the places to offer, the one chosen, and how to choose. */
export type ItemHomeSelectProps = {
  /** The rundown on screen, or undefined while the server has sent none. */
  rundownShown: Rundown | undefined;
  panels: QuickFirePanel[];
  chosenHome: ItemHome;
  onHomeChosen: (home: ItemHome) => void;
};

/** One place offered: the text the dropdown keeps as its value, its words, and the home. */
type HomeChoice = { value: string; optionName: string; home: ItemHome };

const controlId = 'item-editor-home';

/**
 * The value the dropdown keeps for a home. A dropdown option's value is text, so the kind
 * is written in front of the id: a panel and a rundown with the same id stay apart.
 */
function writeHomeAsOptionValue(home: ItemHome): string {
  if (home.kind === 'eventTemplates') {
    return 'eventTemplates';
  }
  return home.kind === 'rundown' ? `rundown:${home.rundownId}` : `quickFire:${home.panelId}`;
}

/**
 * The places a new item may go: the rundown on screen first, then each panel in tab order.
 * A new template ("+ Novo modelo" in "Regras", BAJAOVRLAY-67) goes among the templates
 * only: no panel takes a template, and the server refuses one there.
 */
function listHomeChoices(
  rundownShown: Rundown | undefined,
  panels: QuickFirePanel[],
  chosenHome: ItemHome,
): HomeChoice[] {
  const homeOptions = ptBR.itemEditor.homeOptions;
  if (chosenHome.kind === 'eventTemplates') {
    return [
      {
        value: writeHomeAsOptionValue(chosenHome),
        optionName: homeOptions.eventTemplates,
        home: chosenHome,
      },
    ];
  }
  const choices: HomeChoice[] = [];
  if (rundownShown !== undefined) {
    const home: ItemHome = { kind: 'rundown', rundownId: rundownShown.id };
    choices.push({
      value: writeHomeAsOptionValue(home),
      optionName: homeOptions.rundown(rundownShown.name),
      home,
    });
  }
  // Copied before sorting: the list in the store belongs to the store.
  const panelsInTabOrder = [...panels].sort(
    (onePanel, otherPanel) => onePanel.order - otherPanel.order,
  );
  for (const panel of panelsInTabOrder) {
    const home: ItemHome = { kind: 'quickFire', panelId: panel.id };
    choices.push({
      value: writeHomeAsOptionValue(home),
      optionName: homeOptions.quickFirePanel(panel.name),
      home,
    });
  }
  return choices;
}

/**
 * "Onde": where a new item goes, the rundown on screen or one of the quick-fire panels.
 * It is drawn for a new item only; a stored item is moved with "Mover para rundown" on
 * its panel button. Its value is the editor's own (ItemEditorPanel.tsx), not part of the
 * item's form, because it is sent as createItem's `home` and never as a change.
 */
export function ItemHomeSelect(props: ItemHomeSelectProps) {
  const choices = listHomeChoices(props.rundownShown, props.panels, props.chosenHome);

  function chooseHomeOfOptionValue(optionValue: string): void {
    const choice = choices.find((candidate) => candidate.value === optionValue);
    if (choice !== undefined) {
      props.onHomeChosen(choice.home);
    }
  }

  return (
    <FormFieldRow
      label={ptBR.itemEditor.fields.home}
      controlId={controlId}
      errorMessage={undefined}
    >
      <Select
        value={writeHomeAsOptionValue(props.chosenHome)}
        onValueChange={chooseHomeOfOptionValue}
      >
        <SelectTrigger id={controlId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.optionName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormFieldRow>
  );
}
