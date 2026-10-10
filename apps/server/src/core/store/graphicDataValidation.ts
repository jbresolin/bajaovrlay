import type { Graphic } from '@bajaovrlay/shared';
import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';

/**
 * What is wrong with a graphic's data: the first field its manifest schema refuses and
 * why, or the fact that the schema itself cannot be used. `fieldPath` is the field's
 * name, with dots for a field inside an object (`leader.teamNumber`).
 */
export type GraphicDataProblem =
  | { kind: 'missingField'; fieldPath: string }
  | { kind: 'unknownField'; fieldPath: string }
  | { kind: 'invalidValue'; fieldPath: string }
  | { kind: 'unusableSchema' };

/** The data schema last seen for a graphic id, and the check compiled from it. */
type CompiledDataSchema = {
  manifestSchema: Record<string, unknown>;
  /** Undefined when the schema could not be compiled: it is not a usable JSON Schema. */
  validateData: ValidateFunction | undefined;
};

// Compiling a JSON Schema costs far more than running it, and the race clock is updated
// many times in a race, so each graphic's schema is compiled once and kept by graphic
// id. This is the only state in the file and it never changes an answer: an entry is
// reused only for the very same schema object it was compiled from.
const compiledDataSchemasByGraphicId = new Map<string, CompiledDataSchema>();

// The name used for the data as a whole when the problem is not in one field (for
// example a schema that wants something other than an object).
const nameOfTheWholeData = 'data';

/**
 * Checks data for a take or an update against the JSON Schema in the graphic's manifest
 * and returns the first problem found, or undefined when the data is fine. A graphic
 * whose manifest has no schema accepts any data. Never throws and never changes `data`,
 * so reducers can call it and stay pure.
 */
export function findProblemInGraphicData(
  graphic: Graphic,
  data: Record<string, unknown>,
): GraphicDataProblem | undefined {
  const manifestSchema = graphic.manifest.schema;
  if (manifestSchema === undefined) {
    return undefined;
  }

  const validateData = readOrCompileDataSchema(graphic.id, manifestSchema);
  if (validateData === undefined) {
    return { kind: 'unusableSchema' };
  }

  const isDataValid = validateData(data);
  if (isDataValid) {
    return undefined;
  }
  const firstError = validateData.errors?.[0];
  if (firstError === undefined) {
    // Ajv always lists an error for data it refuses; this keeps a refusal a refusal
    // even if it ever did not.
    return { kind: 'invalidValue', fieldPath: nameOfTheWholeData };
  }
  return describeSchemaErrorAsProblem(firstError);
}

/**
 * Returns the compiled check for a graphic's schema, compiling it the first time (and
 * again if the same graphic id later carries a different schema object, as after a
 * rebuild). Undefined means the schema cannot be compiled; that answer is kept too, so
 * a broken schema is not compiled again on every take.
 */
function readOrCompileDataSchema(
  graphicId: string,
  manifestSchema: Record<string, unknown>,
): ValidateFunction | undefined {
  const keptEntry = compiledDataSchemasByGraphicId.get(graphicId);
  if (keptEntry !== undefined && keptEntry.manifestSchema === manifestSchema) {
    return keptEntry.validateData;
  }

  let validateData: ValidateFunction | undefined;
  try {
    // A fresh Ajv per schema: one shared instance would refuse to compile a second
    // schema carrying the same `$id` (a rebuilt graphic). `strict: false` because OGraf
    // data schemas carry form hints (`gddType`, `gddOptions`) that are not JSON Schema
    // keywords; strict mode would refuse every such schema. `logger: false` because Ajv
    // otherwise prints plain-text warnings to the console (for example about a `format`
    // it does not know), and a reducer has no request id to log with. What goes unseen:
    // `format` keywords are not enforced (ajv-formats is not installed), so a field
    // declared `format: "date-time"` accepts any text.
    const schemaCompiler = new Ajv2020({ strict: false, logger: false });
    validateData = schemaCompiler.compile(manifestSchema);
  } catch {
    validateData = undefined;
  }
  compiledDataSchemasByGraphicId.set(graphicId, { manifestSchema, validateData });
  return validateData;
}

/** Turns one Ajv error into the kind of problem and the name of the field it is about. */
function describeSchemaErrorAsProblem(schemaError: ErrorObject): GraphicDataProblem {
  // Ajv points at the object that has the problem ("/leader"); for a missing or an
  // unknown field, the field's own name is in the error's params.
  const pathOfTheParent = convertJsonPointerToFieldPath(schemaError.instancePath);
  const params: Record<string, unknown> = schemaError.params;

  if (schemaError.keyword === 'required' && typeof params.missingProperty === 'string') {
    return {
      kind: 'missingField',
      fieldPath: joinFieldPath(pathOfTheParent, params.missingProperty),
    };
  }
  if (
    schemaError.keyword === 'additionalProperties' &&
    typeof params.additionalProperty === 'string'
  ) {
    return {
      kind: 'unknownField',
      fieldPath: joinFieldPath(pathOfTheParent, params.additionalProperty),
    };
  }
  if (pathOfTheParent === '') {
    return { kind: 'invalidValue', fieldPath: nameOfTheWholeData };
  }
  return { kind: 'invalidValue', fieldPath: pathOfTheParent };
}

/**
 * Turns Ajv's JSON pointer ("/leader/teamNumber") into the dotted path used in messages
 * ("leader.teamNumber"); the top of the data ("") stays empty. JSON pointer escapes
 * (`~0`, `~1`) are left as they are: no field name in a graphic's data has `~` or `/`.
 */
function convertJsonPointerToFieldPath(jsonPointer: string): string {
  const pointerWithoutLeadingSlash = jsonPointer.startsWith('/')
    ? jsonPointer.slice(1)
    : jsonPointer;
  return pointerWithoutLeadingSlash.split('/').join('.');
}

/** Adds a field name to the path of the object it is in ("leader" + "teamNumber"). */
function joinFieldPath(pathOfTheParent: string, fieldName: string): string {
  if (pathOfTheParent === '') {
    return fieldName;
  }
  return `${pathOfTheParent}.${fieldName}`;
}
