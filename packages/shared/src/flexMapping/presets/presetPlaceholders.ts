/**
 * Fills the `{{name}}` placeholders of a preset kept as JSON (BAJAOVRLAY-54). Only the
 * texts of the preset are read, never its keys; a number or a boolean is copied as it is.
 * A placeholder with no value is a mistake in the preset or its caller, so it throws:
 * a request must never go out with "{{eventId}}" in it.
 */

/** The value of each placeholder, by its name: `{ eventId: '26BR' }` fills `{{eventId}}`. */
export type PresetParameterValues = Readonly<Record<string, string>>;

// A placeholder: two braces, a plain name, two braces.
const placeholderPattern = /\{\{([A-Za-z]+)\}\}/g;

/** Gives a copy of the preset with every placeholder of its texts filled in. */
export function fillPresetPlaceholders(preset: unknown, values: PresetParameterValues): unknown {
  if (typeof preset === 'string') {
    return fillPlaceholdersOfOneText(preset, values);
  }
  if (Array.isArray(preset)) {
    return preset.map((element: unknown) => fillPresetPlaceholders(element, values));
  }
  if (preset !== null && typeof preset === 'object') {
    const filledObject: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(preset)) {
      filledObject[key] = fillPresetPlaceholders(value, values);
    }
    return filledObject;
  }
  return preset;
}

/** One text with its placeholders filled; throws on one with no value. */
function fillPlaceholdersOfOneText(text: string, values: PresetParameterValues): string {
  return text.replace(placeholderPattern, (wholePlaceholder: string, name: string) => {
    const value = values[name];
    if (value === undefined) {
      throw new Error(`no value given for the preset placeholder ${wholePlaceholder}`);
    }
    return value;
  });
}
