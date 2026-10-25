/**
 * Builds, from a graphic's JSON Schema, the Zod schema that gives the operator a pt-BR
 * message under the field while they are still typing, before anything is sent.
 *
 * The server's Ajv check of the same JSON Schema stays the authority
 * (apps/server/src/core/store/graphicDataValidation.ts): this file is a courtesy that
 * covers the shapes the form can edit and nothing else. The two disagree in both
 * directions. This one is more lenient where it ignores `additionalProperties`,
 * `pattern`, every `format` except `date-time` and every property the form shows as
 * unsupported; the server then refuses the command with INVALID_GRAPHIC_DATA. It is
 * stricter in three places: it checks `date-time` (the server enforces no format), it
 * refuses a required text left empty, and it refuses a whole number outside JavaScript's
 * safe range. String length is counted in code points by both.
 *
 * M3 extends this file together with describeSchemaFormFromDataSchema.ts.
 */
import { z } from 'zod';

import { ptBR } from '@/i18n/ptBR';

import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import { formatMillisecondsAsMinutesAndSeconds } from './minutesAndSeconds';
import type { SchemaFormFieldDescription } from './schemaFormDescription';

const fieldErrors = ptBR.schemaForm.fieldErrors;
const textListErrors = ptBR.textList.errors;

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

/**
 * Counts a text's length the way JSON Schema does (and the server's Ajv): in code points,
 * so an accented letter or an emoji counts once.
 */
function countCodePoints(text: string): number {
  return [...text].length;
}

/**
 * The rule for a list of texts: how many lines (`minItems`, `maxItems`) and how long each
 * may be (the items' `minLength`, `maxLength`). Written as one check over the whole list,
 * not as a rule per line, so the message can name the line by its number ("Mensagem 2: no
 * máximo 50 caracteres (tem 84).") and give the limit, which is what the operator needs to
 * shorten it. The first problem found is the one reported, the list's count first.
 */
function buildRuleForTextList(field: SchemaFormFieldDescription): z.ZodType {
  const itemLabel = field.listItemLabel ?? ptBR.textList.defaultItemLabel;
  const listOfTexts = z.array(z.string(), {
    error: chooseMessageForMissingOrWrongType(field, fieldErrors.notText(field.label)),
  });
  return listOfTexts.superRefine((texts, context) => {
    if (field.minimumItems !== undefined && texts.length < field.minimumItems) {
      context.addIssue({
        code: 'custom',
        message: textListErrors.tooFewLines(field.label, field.minimumItems),
      });
      return;
    }
    if (field.maximumItems !== undefined && texts.length > field.maximumItems) {
      context.addIssue({
        code: 'custom',
        message: textListErrors.tooManyLines(field.label, field.maximumItems),
      });
      return;
    }
    for (const [index, text] of texts.entries()) {
      const lineNumber = index + 1;
      // The lines arrive trimmed (fieldValueConversion.ts), so a line of spaces is empty
      // here: refused whatever minLength says, as the server's pattern "\S" would.
      if (text === '') {
        context.addIssue({
          code: 'custom',
          path: [index],
          message: textListErrors.lineBlank(itemLabel, lineNumber),
        });
        return;
      }
      const length = countCodePoints(text);
      if (field.minimumLength !== undefined && length < field.minimumLength) {
        context.addIssue({
          code: 'custom',
          path: [index],
          message: textListErrors.lineTooShort(itemLabel, lineNumber, field.minimumLength),
        });
        return;
      }
      if (field.maximumLength !== undefined && length > field.maximumLength) {
        context.addIssue({
          code: 'custom',
          path: [index],
          message: textListErrors.lineTooLong(itemLabel, lineNumber, field.maximumLength, length),
        });
        return;
      }
    }
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
    case 'textList':
      return buildRuleForTextList(field);
    case 'unsupported':
      return undefined;
  }
}

/**
 * Builds the Zod schema of a graphic's data from its manifest's JSON Schema. It checks
 * an object of data (not what the controls hold): text, option, ISO 8601 date and time,
 * whole or decimal number with its minimum and maximum, true/false, a list of texts with
 * its count and each line's length, and whether each required key is there. Every
 * message is pt-BR and names the field by its label.
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
