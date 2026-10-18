import { z } from 'zod';

import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import {
  type FlexMappingConfig,
  FlexMappingConfigSchema,
} from '../flexMapping/flexMappingConfig.js';
import { ptBRHttpJsonConfig } from './ptBRHttpJsonConfig.js';

/** The most requests one flex source makes per poll: every one is fetched at every poll. */
export const mostRequestsPerHttpJsonSource = 5;

/**
 * The prefix every environment variable a config names must start with. The dataSources
 * slice goes to every operator connection and into the event log, so a token is never
 * written in a config: the config names a variable and the server reads it at poll time.
 * The prefix stops a config from sending some other server secret (DATABASE_PATH, a
 * cloud key) to an address someone typed.
 */
export const sourceEnvironmentVariablePrefix = 'BAJAOVRLAY_SOURCE_';

// BAJAOVRLAY_SOURCE_ and at least one more capital, digit or "_": the shape .env.example shows.
const sourceEnvironmentVariableNamePattern = /^BAJAOVRLAY_SOURCE_[A-Z0-9_]+$/;

// A short plain name, quoted in every error line: "classificacao", "direcao_de_prova".
const requestIdPattern = /^[A-Za-z0-9_-]{1,40}$/;

// An HTTP header name is a "token" (RFC 9110 §5.6.2); fetch refuses anything else.
const headerNamePattern = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

// A line break or NUL in a header value would let one value write a second header.
const lineBreakOrNulPattern = /[\r\n\0]/;

/**
 * One header or query parameter: its name and exactly one of `value` (sent as written)
 * or `valueFromEnvironment` (the name of a BAJAOVRLAY_SOURCE_ variable the server reads
 * at poll time, for a token). One strict object checked by hand rather than a union, so
 * a refusal names the field that is wrong instead of listing both forms.
 */
const NameAndValueFields = {
  name: z.string(),
  value: z.string().optional(),
  valueFromEnvironment: z.string().optional(),
};

/** A header of a request: a token name, and a value with no line break. */
export const HttpJsonHeaderSchema = z
  .strictObject(NameAndValueFields)
  .superRefine((header, context) => {
    if (!headerNamePattern.test(header.name)) {
      context.addIssue({
        code: 'custom',
        path: ['name'],
        message: ptBRHttpJsonConfig.badHeaderName(header.name),
      });
      return;
    }
    checkExactlyOneValue(header, context);
    if (header.value !== undefined && lineBreakOrNulPattern.test(header.value)) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: ptBRHttpJsonConfig.headerValueWithLineBreak(header.name),
      });
    }
  });

/** One header after it has passed HttpJsonHeaderSchema. */
export type HttpJsonHeader = z.infer<typeof HttpJsonHeaderSchema>;

/** A query parameter of a request: any name that is not empty (the URL encodes it). */
export const HttpJsonQueryParameterSchema = z
  .strictObject(NameAndValueFields)
  .superRefine((queryParameter, context) => {
    if (queryParameter.name.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['name'],
        message: ptBRHttpJsonConfig.emptyParameterName,
      });
      return;
    }
    checkExactlyOneValue(queryParameter, context);
  });

/** One query parameter after it has passed HttpJsonQueryParameterSchema. */
export type HttpJsonQueryParameter = z.infer<typeof HttpJsonQueryParameterSchema>;

/**
 * One request of a flex source: a GET of `url` with its headers and query parameters.
 * GET only, and there is no method key at all: a poll must never change anything on the
 * other side. Strict, so a "method" (or a misspelt key) is refused instead of ignored.
 */
export const HttpJsonRequestSchema = z.strictObject(
  {
    /** The short name mappings read this request's response by: "classificacao". */
    requestId: z.string().superRefine((requestId, context) => {
      if (!requestIdPattern.test(requestId)) {
        context.addIssue({ code: 'custom', message: ptBRHttpJsonConfig.badRequestId(requestId) });
      }
    }),
    /** An http:// or https:// address. No address filter: see the adapter's README. */
    url: z.string().superRefine((url, context) => {
      if (!isHttpOrHttpsAddress(url)) {
        context.addIssue({ code: 'custom', message: ptBRHttpJsonConfig.urlNotHttp(url) });
      }
    }),
    headers: z.array(HttpJsonHeaderSchema).default([]),
    queryParameters: z.array(HttpJsonQueryParameterSchema).default([]),
  },
  { error: explainUnknownKeysOfRequest },
);

/** One request after it has passed HttpJsonRequestSchema, its lists filled in. */
export type HttpJsonRequest = z.infer<typeof HttpJsonRequestSchema>;

/**
 * How a flex HTTP/JSON source is set up: one to five requests, fetched together at every
 * poll, and the flex mapping of their responses into the canonical shapes (see
 * ../flexMapping/). Every requestId a mapping names must be one of the requests, and
 * request ids are unique; the mapping checks its own paths, targets and transforms. The
 * control page's form and the server's httpJson adapter use this same schema (D4).
 */
export const HttpJsonConfigSchema = z
  .strictObject({
    requests: z
      .array(HttpJsonRequestSchema)
      .min(1, { error: ptBRHttpJsonConfig.noRequest })
      .max(mostRequestsPerHttpJsonSource, {
        error: ptBRHttpJsonConfig.tooManyRequests(mostRequestsPerHttpJsonSource),
      }),
    mappings: FlexMappingConfigSchema,
  })
  .superRefine((config, context) => {
    checkRequestIdsOfConfig(config.requests, config.mappings, context);
  });

/** A flex source's config after it has passed HttpJsonConfigSchema. */
export type HttpJsonConfig = z.infer<typeof HttpJsonConfigSchema>;

/** Tells whether text parses as an address whose protocol is http or https. */
function isHttpOrHttpsAddress(text: string): boolean {
  if (!URL.canParse(text)) {
    return false;
  }
  const protocol = new URL(text).protocol;
  return protocol === 'http:' || protocol === 'https:';
}

/** Gives the pt-BR sentence for a misspelt key (or "method") on a request; Zod's own otherwise. */
function explainUnknownKeysOfRequest(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'unrecognized_keys') {
    return ptBRHttpJsonConfig.unknownKeysInRequest(issue.keys);
  }
  return undefined;
}

/**
 * Checks that a header or query parameter has exactly one of value and
 * valueFromEnvironment, and that a variable it names has the BAJAOVRLAY_SOURCE_ prefix.
 */
function checkExactlyOneValue(
  nameAndValue: {
    name: string;
    value?: string | undefined;
    valueFromEnvironment?: string | undefined;
  },
  context: z.RefinementCtx,
): void {
  const hasValue = nameAndValue.value !== undefined;
  const hasVariable = nameAndValue.valueFromEnvironment !== undefined;
  if (hasValue === hasVariable) {
    context.addIssue({
      code: 'custom',
      path: [],
      message: ptBRHttpJsonConfig.needsExactlyOneValue(nameAndValue.name),
    });
    return;
  }
  const variableName = nameAndValue.valueFromEnvironment;
  if (variableName !== undefined && !sourceEnvironmentVariableNamePattern.test(variableName)) {
    context.addIssue({
      code: 'custom',
      path: ['valueFromEnvironment'],
      message: ptBRHttpJsonConfig.environmentVariableNotAllowed(variableName),
    });
  }
}

/** Checks that request ids are unique and that every mapping reads one of the requests. */
function checkRequestIdsOfConfig(
  requests: HttpJsonRequest[],
  mappings: FlexMappingConfig,
  context: z.RefinementCtx,
): void {
  const requestIdsSeen = new Set<string>();
  requests.forEach((request, requestIndex) => {
    if (requestIdsSeen.has(request.requestId)) {
      context.addIssue({
        code: 'custom',
        path: ['requests', requestIndex, 'requestId'],
        message: ptBRHttpJsonConfig.requestIdTwice(request.requestId),
      });
    }
    requestIdsSeen.add(request.requestId);
  });

  mappings.forEach((mapping, mappingIndex) => {
    if (!requestIdsSeen.has(mapping.requestId)) {
      context.addIssue({
        code: 'custom',
        path: ['mappings', mappingIndex, 'requestId'],
        message: ptBRHttpJsonConfig.unknownRequestInMapping(
          ptBRDataShapes.shapeNames[mapping.shapeKey],
          mapping.requestId,
        ),
      });
    }
  });
}
