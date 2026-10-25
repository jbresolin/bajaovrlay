/**
 * What every element of a whole list of a source always carries, and so which graphic list
 * field it fits. A graphic's list field is an `array` whose `items.required` names what each
 * element must have; a whole list fits it only when its elements always carry all of those,
 * or the take would fail on the manifest's schema after the operator chose the binding
 * (gate 2 of PR #25: the score parts were offered to the tower's cars). Listed by hand, like
 * the bindable paths; listItemKeys.test.ts proves each list against its item schema.
 */
/** The value types that are a whole list (a subset of BindableValueType). */
export type ListValueType =
  | 'positionsEntries'
  | 'standingsEntries'
  | 'standingsScoreParts'
  | 'bracketsRounds'
  | 'incidentsEntries';

/** Every whole list, in the order the binding picker shows them. */
export const listValueTypes: ListValueType[] = [
  'positionsEntries',
  'standingsEntries',
  'standingsScoreParts',
  'bracketsRounds',
  'incidentsEntries',
];

/**
 * The keys every element of each whole list always has (the keys its shape requires).
 * A standings team's rank is not among them: a disqualified team has none.
 */
export const keysEveryItemOfTheListCarries: Record<ListValueType, string[]> = {
  positionsEntries: ['position', 'carNumber', 'teamName', 'schoolName', 'laps', 'status'],
  standingsEntries: ['carNumber', 'teamName', 'schoolName', 'points'],
  standingsScoreParts: ['partId', 'label'],
  bracketsRounds: ['name', 'matches'],
  incidentsEntries: ['incidentId', 'carNumber', 'teamName', 'schoolName', 'kind', 'reason'],
};

/** Says whether a value read from a manifest is a plain object, so its fields can be read. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The keys a list field's `items.required` names; none when it names none. */
function readKeysTheFieldRequiresOfEachItem(arrayField: Record<string, unknown>): string[] {
  const items = arrayField.items;
  const required = isPlainObject(items) ? items.required : undefined;
  if (!Array.isArray(required)) {
    return [];
  }
  return required.filter((key): key is string => typeof key === 'string');
}

/**
 * The rule every whole list follows, a source's or the entity library's (BAJAOVRLAY-46):
 * every key the list field's `items.required` names is among the keys each element of the
 * list always carries. A field that requires nothing takes any list.
 */
export function doElementsCarryEveryKeyTheArrayFieldRequires(
  keysEveryElementCarries: string[],
  arrayField: Record<string, unknown>,
): boolean {
  const keysRequired = readKeysTheFieldRequiresOfEachItem(arrayField);
  return keysRequired.every((key) => keysEveryElementCarries.includes(key));
}

/** Whether a whole list of a source fits one list field, by the rule above. */
export function doesListFitArrayField(
  listType: ListValueType,
  arrayField: Record<string, unknown>,
): boolean {
  return doElementsCarryEveryKeyTheArrayFieldRequires(
    keysEveryItemOfTheListCarries[listType],
    arrayField,
  );
}
