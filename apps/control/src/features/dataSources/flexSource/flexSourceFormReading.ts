import { type HttpJsonConfig, HttpJsonConfigSchema } from '@bajaovrlay/shared';
import { type FieldErrors, type ResolverResult, set } from 'react-hook-form';

import { ptBR } from '@/i18n/ptBR';

import {
  findErrorsOfLabelAndPollInterval,
  readPollIntervalMs,
  type ValidSourceFormReading,
} from '../sourceFormReading';
import { buildFlexConfigFromFormValues, type FormRowsOfRules } from './flexConfigFromFormValues';
import type { FlexConfigFormValues, FlexSourceFormValues } from './flexSourceFormValues';

/**
 * How the flex form is read: the config is built from the fields
 * (flexConfigFromFormValues.ts) and checked with the shared HttpJsonConfigSchema, the one
 * the server checks createDataSource with (D4). Each refusal is put under the field it is
 * about ("requests.0.url", "mappings.1.fieldRules.6.pathOrConstantText"); one the form has
 * no field for (no shape mapped at all) goes in a list above the buttons.
 */

/** A form with problems: a pt-BR message per field path, and those with no field. */
export type InvalidFlexFormReading = {
  isValid: false;
  errorMessageByFieldPath: Record<string, string>;
  generalProblems: string[];
};

/** What reading only the requests and mappings answers ("Testar", "Exportar"). */
export type FlexConfigFormReading =
  { isValid: true; config: HttpJsonConfig } | InvalidFlexFormReading;

/** What reading the whole form answers ("Salvar fonte"). */
export type FlexSourceFormReading = ValidSourceFormReading<HttpJsonConfig> | InvalidFlexFormReading;

/** Reads the requests and mappings into a checked config, or the problems of each field. */
export function readFlexConfigFormValues(values: FlexConfigFormValues): FlexConfigFormReading {
  const { config, formRowsOfRules } = buildFlexConfigFromFormValues(values);
  const parsedConfig = HttpJsonConfigSchema.safeParse(config);
  if (parsedConfig.success) {
    return { isValid: true, config: parsedConfig.data };
  }

  const errorMessageByFieldPath: Record<string, string> = {};
  const generalProblems: string[] = [];
  for (const issue of parsedConfig.error.issues) {
    const message = explainIssueForTheForm(issue);
    const fieldPath = findFormFieldPathOfIssue(issue.path, formRowsOfRules);
    if (fieldPath === undefined) {
      generalProblems.push(message);
      continue;
    }
    // The first problem of a field is the one to fix first; later ones wait their turn.
    if (errorMessageByFieldPath[fieldPath] === undefined) {
      errorMessageByFieldPath[fieldPath] = message;
    }
  }
  return { isValid: false, errorMessageByFieldPath, generalProblems };
}

/** Reads the whole form: a flex source ready to send, or the problems of each field. */
export function readFlexSourceForm(values: FlexSourceFormValues): FlexSourceFormReading {
  const labelAndIntervalErrors = findErrorsOfLabelAndPollInterval(values);
  const configReading = readFlexConfigFormValues(values);

  const hasLabelOrIntervalErrors = Object.keys(labelAndIntervalErrors).length > 0;
  if (configReading.isValid && !hasLabelOrIntervalErrors) {
    return {
      isValid: true,
      label: values.label.trim(),
      pollIntervalMs: readPollIntervalMs(values.pollIntervalSeconds),
      config: configReading.config,
    };
  }
  const configErrors = configReading.isValid ? {} : configReading.errorMessageByFieldPath;
  return {
    isValid: false,
    errorMessageByFieldPath: { ...labelAndIntervalErrors, ...configErrors },
    generalProblems: configReading.isValid ? [] : configReading.generalProblems,
  };
}

/**
 * The bridge between readFlexSourceForm and react-hook-form: the values when the form is
 * valid, otherwise each message at its field, and the problems with no field as the
 * form's `root.general` error, their sentences one after the other.
 */
export function resolveFlexSourceForm(
  values: FlexSourceFormValues,
): ResolverResult<FlexSourceFormValues> {
  const reading = readFlexSourceForm(values);
  if (reading.isValid) {
    return { values, errors: {} };
  }
  const errors: FieldErrors<FlexSourceFormValues> = {};
  for (const [fieldPath, message] of Object.entries(reading.errorMessageByFieldPath)) {
    set(errors, fieldPath, { type: 'validation', message });
  }
  if (reading.generalProblems.length > 0) {
    const message = reading.generalProblems.join(' ');
    errors.root = { general: { type: 'validation', message } };
  }
  return { values: {}, errors };
}

/**
 * The sentence to show for one refusal: the schema's own pt-BR one, except for a "Valor
 * fixo" that read as a list or null, where Zod's built-in message is English.
 */
function explainIssueForTheForm(issue: { code: string; path: PropertyKey[]; message: string }) {
  const isAConstantOfTheWrongType =
    issue.path.at(-1) === 'constantValue' && issue.code !== 'custom';
  if (isAConstantOfTheWrongType) {
    return ptBR.dataSources.flexForm.fieldErrors.constantNotTextNumberOrBoolean;
  }
  return issue.message;
}

/** The form field a refusal is about, or undefined when it is about no one field. */
function findFormFieldPathOfIssue(
  issuePath: PropertyKey[],
  formRowsOfRules: FormRowsOfRules,
): string | undefined {
  const [part, ...restOfPath] = issuePath;
  if (part === 'requests') {
    return findFormFieldPathInRequests(restOfPath);
  }
  if (part === 'mappings') {
    return findFormFieldPathInMappings(restOfPath, formRowsOfRules);
  }
  return undefined;
}

/** The field of a request's refusal: its name, address, or a header or parameter row. */
function findFormFieldPathInRequests(issuePath: PropertyKey[]): string | undefined {
  const [requestIndex, requestKey, rowIndex, rowKey] = issuePath;
  if (typeof requestIndex !== 'number') {
    return undefined;
  }
  const requestPath = `requests.${requestIndex}`;
  if (requestKey === 'requestId' || requestKey === 'url') {
    return `${requestPath}.${requestKey}`;
  }
  const isARowOfTheRequest = requestKey === 'headers' || requestKey === 'queryParameters';
  if (!isARowOfTheRequest || typeof rowIndex !== 'number') {
    return undefined;
  }
  // A bad name goes under the name; "exactly one value" and a bad value or variable
  // go under the value.
  const rowField = rowKey === 'name' ? 'name' : 'valueText';
  return `${requestPath}.${requestKey}.${rowIndex}.${rowField}`;
}

/** The field of a mapping's refusal: its request, its list path, or one field's row. */
function findFormFieldPathInMappings(
  issuePath: PropertyKey[],
  formRowsOfRules: FormRowsOfRules,
): string | undefined {
  const [mappingIndex, mappingKey, ruleIndex, ruleKey] = issuePath;
  if (typeof mappingIndex !== 'number') {
    return undefined;
  }
  const mappingPath = `mappings.${mappingIndex}`;
  if (mappingKey === 'requestId' || mappingKey === 'entriesPath') {
    return `${mappingPath}.${mappingKey}`;
  }
  const isARuleOfTheMapping = mappingKey === 'fields' || mappingKey === 'entryFields';
  if (!isARuleOfTheMapping || typeof ruleIndex !== 'number') {
    return undefined;
  }
  const rowIndex = formRowsOfRules[mappingIndex]?.[mappingKey][ruleIndex];
  if (rowIndex === undefined) {
    return undefined;
  }
  // A transform or its table goes under the transform; anything else under the path or value.
  const isAboutTheTransform = ruleKey === 'transformId' || ruleKey === 'transformParameters';
  const rowField = isAboutTheTransform ? 'transformId' : 'pathOrConstantText';
  return `${mappingPath}.fieldRules.${rowIndex}.${rowField}`;
}
