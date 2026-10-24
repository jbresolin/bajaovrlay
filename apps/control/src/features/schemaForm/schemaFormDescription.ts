/**
 * What the control page knows about a graphic's data once its manifest's JSON Schema has
 * been read: one description per property, in the order the manifest lists them. Every
 * other file in this folder works from these descriptions and never looks at the JSON
 * Schema again (the one exception is zodSchemaFromDataSchema.ts, which the brief asks to
 * be built from the schema itself).
 *
 * Only types live here. describeSchemaFormFromDataSchema.ts builds them.
 */

/**
 * Which control draws a property:
 * - `text`: a one-line text input (`type: string`);
 * - `select`: a dropdown (`type: string` with `enum`);
 * - `dateTime`: a date and time input (`type: string`, `format: date-time`);
 * - `number`: a number input (`type: integer` or `number`);
 * - `duration`: a text field typed as mm:ss (`integer`/`number` with `v_baja.unit: ms`);
 * - `switch`: an on/off switch (`type: boolean`);
 * - `textList`: one text input per line, with add, remove and drag to reorder (`type:
 *   array` whose `items` are plain `type: string`, the ticker's messages, BAJAOVRLAY-23);
 * - `unsupported`: a read-only JSON box, for every shape the form cannot edit yet
 *   (lists of anything but texts, nested objects, `oneOf` and the like).
 */
export type SchemaFormControl =
  'text' | 'select' | 'dateTime' | 'number' | 'duration' | 'switch' | 'textList' | 'unsupported';

/** One choice of a dropdown: the value the graphic receives and the words the operator reads. */
export type SchemaFormSelectOption = {
  value: string;
  label: string;
};

/** Everything the form needs to draw, check and send one property of a graphic's data. */
export type SchemaFormFieldDescription = {
  /** The property's key in the graphic's data, for example `sessionName`. */
  key: string;
  /** The manifest's `title`, or the key when the manifest gives none. */
  label: string;
  /** The manifest's `description`, shown under the control; undefined when there is none. */
  help: string | undefined;
  /** Whether the manifest lists the key under `required`. */
  isRequired: boolean;
  control: SchemaFormControl;
  /** The dropdown's choices, in the manifest's order. Empty for every other control. */
  selectOptions: SchemaFormSelectOption[];
  /** True for `type: integer`: a number with a decimal part is refused. */
  isWholeNumber: boolean;
  /** The manifest's `minimum` and `maximum` (numbers and durations), when given. */
  minimum: number | undefined;
  maximum: number | undefined;
  /**
   * The manifest's `minLength` and `maxLength` (text), when given. For a `textList` they
   * are its `items`' own, the limit of each line.
   */
  minimumLength: number | undefined;
  maximumLength: number | undefined;
  /** A `textList`'s `minItems` and `maxItems`, when given; undefined for every other control. */
  minimumItems: number | undefined;
  maximumItems: number | undefined;
  /**
   * What one line of a `textList` is called: its `items`' `title` ("Mensagem"), or
   * "Linha" when there is none. The add button, each line's controls and its messages are
   * named with it. Undefined for every other control.
   */
  listItemLabel: string | undefined;
  /**
   * Whether the operator may choose "filled by the server at the take" instead of typing
   * a value: true for an integer property whose `v_baja.role` is `wallClock`.
   */
  offersTakeTime: boolean;
  /**
   * The manifest's `v_baja.role` exactly as written, or undefined when there is none (or
   * it is not text). The form itself reads only `wallClock` (see `offersTakeTime`); the
   * word is handed on so a panel can find a field by what it is for instead of by its key.
   */
  role: string | undefined;
  /**
   * The manifest's `default`, exactly as written (undefined when there is none). It is
   * data, not text for a control: buildSchemaFormValues.ts turns it into what the control
   * shows, and ignores it when it is not a value the control can show.
   */
  defaultDataValue: unknown;
};

/** A graphic's whole data schema, read for the form. */
export type SchemaFormDescription = {
  /** One description per property, in the manifest's order. Empty when there is no schema. */
  fields: SchemaFormFieldDescription[];
  /**
   * True when the schema is there but is not `type: object` with `properties`, so nothing
   * can be drawn field by field. The form then shows one read-only JSON box with all the
   * data, and a take sends that data on untouched.
   */
  isWholeDataSchemaUnsupported: boolean;
  /**
   * The JSON Schema these descriptions were read from, kept so the form's rules
   * (zodSchemaFromDataSchema.ts) are built from the very same schema.
   */
  dataSchema: unknown;
};
