import { type CarGroup, highestPlaceACarCanBePickedAt } from '@bajaovrlay/shared';
import { type UseFormReturn, useWatch } from 'react-hook-form';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import { readCarPickShownInGroup } from './carGroupChoice';
import { writeCarPickIntoForm } from './carGroupFormWrites';
import type { SchemaFormValues } from './schemaFormValues';

const texts = ptBR.carGroups;

// A battle for the Nth place needs a car at N + 1, so the last place offered is the 9th.
const battlePlaceNumbersOffered = Array.from(
  { length: highestPlaceACarCanBePickedAt - 1 },
  (_unused, index) => index + 1,
);

/**
 * "Disputa pela posição" on the battle card's car ahead (BAJAOVRLAY-66): "Disputa pela 2ª
 * posição" picks the car ahead at the 2nd place and the car behind at the 3rd, both by
 * place, so the card follows whichever cars run 2nd and 3rd. Both cars keep one source
 * and one "Ao vivo" (the car ahead's). It shows the battle while both cars are picked so,
 * and "Escolha…" otherwise.
 */
export function CarBattleSelect(props: {
  form: UseFormReturn<SchemaFormValues>;
  carGroupAhead: CarGroup;
  carGroupBehind: CarGroup;
  /** The source a new pick starts on: the one shown, or the only source there is. */
  chooseSourceForANewPick: (sourceIdShown: string) => string;
  isDisabled: boolean;
}) {
  const { form, carGroupAhead, carGroupBehind } = props;
  // Redraws when the car behind changes too; the car ahead's group redraws this anyway.
  useWatch({ control: form.control, name: `carGroupWays.${carGroupBehind.id}` });
  useWatch({
    control: form.control,
    name: Object.keys(carGroupBehind.fields).map((fieldKey) => `bindings.${fieldKey}` as const),
  });
  const formValuesNow = form.getValues();
  const battlePlaceShown = readBattlePlaceShown(formValuesNow);

  /** The place the cars battle for, while the car behind is picked right after the car ahead. */
  function readBattlePlaceShown(formValues: SchemaFormValues): number | undefined {
    const ways = formValues.carGroupWays ?? {};
    if (ways[carGroupAhead.id] !== 'place' || ways[carGroupBehind.id] !== 'place') {
      return undefined;
    }
    const pickAhead = readCarPickShownInGroup(carGroupAhead, formValues, 'place');
    const pickBehind = readCarPickShownInGroup(carGroupBehind, formValues, 'place');
    if (pickAhead.pickedBy !== 'place' || pickBehind.pickedBy !== 'place') {
      return undefined;
    }
    const isTheCarBehindRightBehind =
      pickAhead.placeNumber !== undefined && pickBehind.placeNumber === pickAhead.placeNumber + 1;
    return isTheCarBehindRightBehind ? pickAhead.placeNumber : undefined;
  }

  function chooseBattle(placeText: string): void {
    const placeNumber = Number(placeText);
    const pickAheadBefore = readCarPickShownInGroup(carGroupAhead, form.getValues(), 'place');
    const sourceId = props.chooseSourceForANewPick(pickAheadBefore.sourceId);
    const isLive = pickAheadBefore.isLive;
    writeCarPickIntoForm(form, carGroupAhead, { pickedBy: 'place', sourceId, placeNumber, isLive });
    writeCarPickIntoForm(form, carGroupBehind, {
      pickedBy: 'place',
      sourceId,
      placeNumber: placeNumber + 1,
      isLive,
    });
  }

  return (
    <Select
      value={battlePlaceShown === undefined ? '' : String(battlePlaceShown)}
      onValueChange={chooseBattle}
      disabled={props.isDisabled}
    >
      <SelectTrigger size="sm" className="w-full" aria-label={texts.battleLabel}>
        <SelectValue placeholder={texts.battleLabel} />
      </SelectTrigger>
      <SelectContent>
        {battlePlaceNumbersOffered.map((placeNumber) => (
          <SelectItem key={placeNumber} value={String(placeNumber)}>
            {texts.battleOption(placeNumber)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
