/**
 * Writing a car group's choice into react-hook-form (BAJAOVRLAY-66): a pick fills every
 * field of the group alike (its kind "Fonte" and its own binding), typing by hand turns
 * every field back to typed (the values typed stay underneath), and the group's way is
 * kept beside the fields. Both the group's picker and the battle card's "Disputa pela Nª
 * posição" (which writes two groups) go through here, so they cannot write differently.
 */
import type { CarGroup } from '@bajaovrlay/shared';
import type { UseFormReturn } from 'react-hook-form';

import { buildBindingValuesOfCarPick, type CarPickInForm } from './carGroupChoice';
import type { CarGroupWay, SchemaFormValues } from './schemaFormValues';

/** Keeps the way a group is chosen, as the operator changed it. */
export function writeCarGroupWay(
  form: UseFormReturn<SchemaFormValues>,
  carGroup: CarGroup,
  way: CarGroupWay,
): void {
  form.setValue(`carGroupWays.${carGroup.id}`, way, { shouldDirty: true });
}

/** Fills every field of the group with its own binding to the car picked. */
export function writeCarPickIntoForm(
  form: UseFormReturn<SchemaFormValues>,
  carGroup: CarGroup,
  pick: CarPickInForm,
): void {
  const bindingValues = buildBindingValuesOfCarPick(carGroup, pick);
  for (const [fieldKey, bindingValue] of Object.entries(bindingValues)) {
    form.setValue(`kinds.${fieldKey}`, 'binding', { shouldDirty: true });
    form.setValue(`bindings.${fieldKey}`, bindingValue, { shouldDirty: true });
  }
  writeCarGroupWay(form, carGroup, pick.pickedBy === 'number' ? 'carNumber' : 'place');
  checkGroupAgainAfterAFailedSave(form, carGroup);
}

/**
 * Reads every field of the group from the event's payload field of its own meaning
 * ("Do evento", BAJAOVRLAY-67): the car, the team and the school of the event shown.
 */
export function writeCarGroupFromTheEvent(
  form: UseFormReturn<SchemaFormValues>,
  carGroup: CarGroup,
): void {
  for (const [fieldKey, meaning] of Object.entries(carGroup.fields)) {
    form.setValue(`kinds.${fieldKey}`, 'eventField', { shouldDirty: true });
    form.setValue(`eventPaths.${fieldKey}`, meaning, { shouldDirty: true });
  }
  writeCarGroupWay(form, carGroup, 'fromTheEvent');
  checkGroupAgainAfterAFailedSave(form, carGroup);
}

/** Turns every field of the group back to typed; what was typed before is still there. */
export function writeCarGroupTypedByHand(
  form: UseFormReturn<SchemaFormValues>,
  carGroup: CarGroup,
): void {
  for (const fieldKey of Object.keys(carGroup.fields)) {
    form.setValue(`kinds.${fieldKey}`, 'literal', { shouldDirty: true });
  }
  writeCarGroupWay(form, carGroup, 'typed');
  checkGroupAgainAfterAFailedSave(form, carGroup);
}

/**
 * Checks the group's fields again when one of them shows a message (a save was refused),
 * so the message goes as soon as the pick is complete. Otherwise nothing is checked, as
 * for every other field: the editor shows no message before a button is pressed.
 */
function checkGroupAgainAfterAFailedSave(
  form: UseFormReturn<SchemaFormValues>,
  carGroup: CarGroup,
): void {
  const valueNames = Object.keys(carGroup.fields).map((fieldKey) => `values.${fieldKey}` as const);
  const isAnyFieldShowingAMessage = valueNames.some(
    (valueName) => form.getFieldState(valueName).error !== undefined,
  );
  if (isAnyFieldShowingAMessage) {
    void form.trigger(valueNames);
  }
}
