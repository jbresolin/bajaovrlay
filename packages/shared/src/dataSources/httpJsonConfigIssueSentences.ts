/**
 * The pt-BR sentences for what Zod finds wrong in a flex source's config at the level of
 * its objects and fields (a missing field, a list that is not one, a misspelt key), so
 * httpJsonConfig.ts reads as the rules themselves. Split from it by BAJAOVRLAY-53.
 */
import { z } from 'zod';

import { ptBRHttpJsonConfig } from './ptBRHttpJsonConfig.js';

/**
 * A text field whose refusal, when it is missing or holds something else (requestId: 5),
 * is a pt-BR sentence naming the field instead of Zod's English default.
 */
export function textFieldNamed(fieldName: string) {
  return z.string({
    error: (issue) => {
      if (issue.input === undefined) {
        return ptBRHttpJsonConfig.missingField(fieldName);
      }
      return ptBRHttpJsonConfig.fieldNotText(fieldName);
    },
  });
}

/** The pt-BR sentence for a list field that is missing or holds something other than a list. */
export function explainListProblem(fieldName: string) {
  return (issue: z.core.$ZodRawIssue): string | undefined => {
    if (issue.code !== 'invalid_type') {
      return undefined;
    }
    if (issue.input === undefined) {
      return ptBRHttpJsonConfig.missingField(fieldName);
    }
    return ptBRHttpJsonConfig.fieldNotAList(fieldName);
  };
}

/** Gives the pt-BR sentence for a whole config that is not an object or has a misspelt key. */
export function explainProblemOfConfigObject(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'unrecognized_keys') {
    return ptBRHttpJsonConfig.unknownKeysInConfig(issue.keys);
  }
  if (issue.code === 'invalid_type') {
    return ptBRHttpJsonConfig.configNotAnObject;
  }
  return undefined;
}

/** Gives the pt-BR sentence for a request that is not an object or has a misspelt key (or "method"). */
export function explainProblemOfRequestObject(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'unrecognized_keys') {
    return ptBRHttpJsonConfig.unknownKeysInRequest(issue.keys);
  }
  if (issue.code === 'invalid_type') {
    return ptBRHttpJsonConfig.requestNotAnObject;
  }
  return undefined;
}

/** Gives the pt-BR sentence for a header that is not an object or has a misspelt key. */
export function explainProblemOfHeaderObject(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'unrecognized_keys') {
    return ptBRHttpJsonConfig.unknownKeysInHeader(readNameWritten(issue.input), issue.keys);
  }
  if (issue.code === 'invalid_type') {
    return ptBRHttpJsonConfig.headerNotAnObject;
  }
  return undefined;
}

/** Gives the pt-BR sentence for a query parameter that is not an object or has a misspelt key. */
export function explainProblemOfQueryParameterObject(
  issue: z.core.$ZodRawIssue,
): string | undefined {
  if (issue.code === 'unrecognized_keys') {
    return ptBRHttpJsonConfig.unknownKeysInQueryParameter(readNameWritten(issue.input), issue.keys);
  }
  if (issue.code === 'invalid_type') {
    return ptBRHttpJsonConfig.queryParameterNotAnObject;
  }
  return undefined;
}

/** The `name` written on a header or parameter not yet checked, when it is text; undefined otherwise. */
function readNameWritten(input: unknown): string | undefined {
  const hasAName = typeof input === 'object' && input !== null && 'name' in input;
  if (!hasAName) {
    return undefined;
  }
  return typeof input.name === 'string' ? input.name : undefined;
}
