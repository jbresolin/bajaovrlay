/**
 * Builds, from a graphic's JSON Schema, the Zod schema that gives the operator a pt-BR
 * message under the field while they are still typing, before anything is sent.
 *
 * The server's Ajv check of the same JSON Schema stays the authority
 * (apps/server/src/core/store/graphicDataValidation.ts): this file is a courtesy that
 * covers the shapes the form can edit and nothing else. Where the two could disagree,
 * this one is the more lenient: it ignores `additionalProperties`, `pattern`, every
 * `format` except `date-time` and every property the form shows as unsupported, and the
 * server then refuses the command with INVALID_GRAPHIC_DATA.
 *
 * M3 extends this file together with describeSchemaFormFromDataSchema.ts.
 */
import { z } from 'zod';

import { ptBR } from '@/i18n/ptBR';

import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import { formatMillisecondsAsMinutesAndSeconds } from './minutesAndSeconds';
import type { SchemaFormFieldDescription } from './schemaFormDescription';

const fieldErrors = ptBR.schemaForm.fieldErrors;

/** What Zod hands a message function: the value that was refused (undefined when missing). */
type RefusedValue = { input?: unknown };

const millisecondsPerSecond = 1_000;

/** Writes a limit the way the operator typed the field: mm:ss for a time, pt-BR digits otherwise. */
function writeLimitForReading(field: SchemaFormFieldDescription, limit: number): string {
  if (field.control === 'duration') {
    return formatMillisecondsAsMinutesAndSeconds(limit);
  }
  return new Intl.NumberFormat('pt-BR').format(limit);
}

/**
 * Writes a minimum for reading. An mm:ss field holds whole seconds and writing a time
 * drops the part of a second, which is right for a maximum (90 500 ms: nothing over 1:30
 * passes) but wrong for a minimum: 500 ms would read "0:00", the very time that was just
 * refused. So a time's minimum is first raised to the next whole second, the smallest
 * time the operator can actually type.
 */
function writeMinimumForReading(field: SchemaFormFieldDescription, minimum: number): string {
  if (field.control !== 'duration') {
    return writeLimitForReading(field, minimum);
  }
  const smallestWholeSecondAllowed =
    Math.ceil(minimum / millisecondsPerSecond) * millisecondsPerSecond;
  return writeLimitForReading(field, smallestWholeSecondAllowed);
}

/**
 * The message for a value of the wrong type: "required" when there is no value at all,
 * and the given message when there is one of another type.
 */
function chooseMessageForMissingOrWrongType(
  field: SchemaFormFieldDescription,
  messageForWrongType: string,
) {
  return (refusedValue: RefusedValue): string =>
    refusedValue.input === undefined ? fieldErrors.required(field.label) : messageForWrongType;
}

function buildRuleForText(field: SchemaFormFieldDescription): z.ZodType {
  let rule = z.string({
    error: chooseMessageForMissingOrWrongType(field, fieldErrors.notText(field.label)),
  });
  if (field.minimumLength !== undefined) {
    rule = rule.min(field.minimumLength, {
      error: fieldErrors.tooShort(field.label, field.minimumLength),
    });
  }
  if (field.maximumLength !== undefined) {
    rule = rule.max(field.maximumLength, {
      error: fieldErrors.tooLong(field.label, field.maximumLength),
    });
  }
  return rule;
}

function buildRuleForSelect(field: SchemaFormFieldDescription): z.ZodType {
  const optionValues = field.selectOptions.map((option) => option.value);
  return z.enum(optionValues, {
    error: chooseMessageForMissingOrWrongType(field, fieldErrors.notOneOfTheOptions(field.label)),
  });
}

function buildRuleForDateAndTime(field: SchemaFormFieldDescription): z.ZodType {
  // `offset: true` accepts both "…Z" and "…-03:00", as JSON Schema's date-time does.
  return z.iso.datetime({
    offset: true,
    error: chooseMessageForMissingOrWrongType(field, fieldErrors.notADateAndTime(field.label)),
  });
}

/** The rule for a number or an mm:ss time; both are numbers in the graphic's data. */
function buildRuleForNumber(field: SchemaFormFieldDescription): z.ZodType {
  let rule = z.number({
    error: chooseMessageForMissingOrWrongType(field, fieldErrors.notANumber(field.label)),
  });
  if (field.isWholeNumber) {
    rule = rule.int({ error: fieldErrors.notAWholeNumber(field.label) });
  }
  if (field.minimum !== undefined) {
    const limit = writeMinimumForReading(field, field.minimum);
    rule = rule.min(field.minimum, { error: fieldErrors.belowMinimum(field.label, limit) });
  }
  if (field.maximum !== undefined) {
    const limit = writeLimitForReading(field, field.maximum);
    rule = rule.max(field.maximum, { error: fieldErrors.aboveMaximum(field.label, limit) });
  }
  return rule;
}

function buildRuleForSwitch(field: SchemaFormFieldDescription): z.ZodType {
  return z.boolean({
    error: chooseMessageForMissingOrWrongType(field, fieldErrors.notOnOrOff(field.label)),
  });
}

/** The rule for one field the form can edit, before "required or optional" is applied. */
function buildRuleForField(field: SchemaFormFieldDescription): z.ZodType | undefined {
  switch (field.control) {
    case 'text':
      return buildRuleForText(field);
    case 'select':
      return buildRuleForSelect(field);
    case 'dateTime':
      return buildRuleForDateAndTime(field);
    case 'number':
    case 'duration':
      return buildRuleForNumber(field);
    case 'switch':
      return buildRuleForSwitch(field);
    case 'unsupported':
      return undefined;
  }
}

/**
 * Builds the Zod schema of a graphic's data from its manifest's JSON Schema. It checks
 * an object of data (not what the controls hold): text, option, ISO 8601 date and time,
 * whole or decimal number with its minimum and maximum, true/false, and whether each
 * required key is there. Every message is pt-BR and names the field by its label.
 * Keys it does not know, and properties the form cannot edit, pass unchecked; a missing
 * or unsupported schema accepts any object.
 */
export function buildZodSchemaFromDataSchema(
  dataSchema: unknown,
): z.ZodType<Record<string, unknown>> {
  const description = describeSchemaFormFromDataSchema(dataSchema);

  const rulePairs: Array<[string, z.ZodType]> = [];
  for (const field of description.fields) {
    const ruleForField = buildRuleForField(field);
    if (ruleForField === undefined) {
      continue;
    }
    rulePairs.push([field.key, field.isRequired ? ruleForField : ruleForField.optional()]);
  }
  // A loose object lets every other key through, which is how `additionalProperties` and
  // the unsupported properties are left to the server.
  return z.looseObject(Object.fromEntries(rulePairs));
}
