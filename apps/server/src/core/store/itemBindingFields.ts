import {
  type CommandError,
  type DataSource,
  findClockFieldKeysByRole,
  findProblemInBindingForGraphicField,
  type Graphic,
  type ItemFields,
  wholeClockBindingPath,
} from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';
import { readSchemaPropertyOfGraphic } from './graphicSchemaProperties.js';

/**
 * The refusal for the first binding among these fields that cannot be saved on this
 * graphic, or undefined when every binding may be stored (or there is none). In order:
 * the source must be in the dataSources slice, the binding's parts must make sense and
 * its value fit the field (findProblemInBindingForGraphicField, shared with the item
 * editor), and a whole clock must be the only thing filling the clock fields. Run by
 * createItem and updateItemFields, so a mistake is heard while preparing the show.
 * `fieldsOfTheItemAfterTheSave` are the item's fields as they will be stored (for a
 * create, the command's; for an update, merged over the item's), for the clock check.
 * What could go wrong: it judges by the sources and manifest of now. A source deleted
 * after the save is found missing at the take instead, which refuses that take.
 */
export function findRefusalOfBindingFieldsForGraphic(
  graphic: Graphic,
  fieldsInTheCommand: ItemFields,
  fieldsOfTheItemAfterTheSave: ItemFields,
  dataSources: DataSource[],
): CommandError | undefined {
  for (const [fieldKey, fieldValue] of Object.entries(fieldsInTheCommand)) {
    if (fieldValue.kind !== 'binding') {
      continue;
    }
    const fieldTitle = readTitleOfField(graphic, fieldKey);
    const sourceExists = dataSources.some((dataSource) => dataSource.id === fieldValue.sourceId);
    if (!sourceExists) {
      return refuseBindingOfField(
        fieldTitle,
        ptBR.bindingErrors.sourceNotFound(fieldValue.sourceId),
      );
    }
    const problem = findProblemInBindingForGraphicField(fieldValue, graphic, fieldKey);
    if (problem !== undefined) {
      return refuseBindingOfField(fieldTitle, problem);
    }
  }
  return findRefusalOfWholeClockBesideClockFields(graphic, fieldsOfTheItemAfterTheSave);
}

/**
 * The whole clock ("Relógio da fonte") is stored on the field with the role clockTime
 * and fills the other three clock fields at the take. Each of those must then hold
 * nothing, or a literal null (how the editor clears a stored field, since an update
 * cannot remove a key): a value there would be written over, and a takeTime would stamp
 * the take's moment over the source's, making the clock jump.
 */
function findRefusalOfWholeClockBesideClockFields(
  graphic: Graphic,
  fields: ItemFields,
): CommandError | undefined {
  const clockFieldKeys = findClockFieldKeysByRole(graphic);
  if (clockFieldKeys === undefined) {
    return undefined;
  }
  const clockTimeField = fields[clockFieldKeys.clockTime];
  const isWholeClockBound =
    clockTimeField?.kind === 'binding' && clockTimeField.path === wholeClockBindingPath;
  if (!isWholeClockBound) {
    return undefined;
  }
  const otherClockFieldKeys = [
    clockFieldKeys.wallClock,
    clockFieldKeys.clockRunning,
    clockFieldKeys.clockMode,
  ];
  const keyHoldingAValue = otherClockFieldKeys.find((fieldKey) => {
    const fieldValue = fields[fieldKey];
    if (fieldValue === undefined) {
      return false;
    }
    const isClearedLiteral = fieldValue.kind === 'literal' && fieldValue.value === null;
    return !isClearedLiteral;
  });
  if (keyHoldingAValue === undefined) {
    return undefined;
  }
  return refuseBindingOfField(
    readTitleOfField(graphic, clockFieldKeys.clockTime),
    ptBR.bindingErrors.wholeClockBesideAClockField(readTitleOfField(graphic, keyHoldingAValue)),
  );
}

/** The field's title as the item editor shows it, or its key when the schema gives none. */
export function readTitleOfField(graphic: Graphic, fieldKey: string): string {
  const title = readSchemaPropertyOfGraphic(graphic, fieldKey)?.title;
  return typeof title === 'string' && title.trim() !== '' ? title : fieldKey;
}

/** The INVALID_BINDING refusal, the field's title before the sentence. */
function refuseBindingOfField(fieldTitle: string, sentence: string): CommandError {
  return {
    code: 'INVALID_BINDING',
    message: ptBR.bindingErrors.aboutField(fieldTitle, sentence),
  };
}
