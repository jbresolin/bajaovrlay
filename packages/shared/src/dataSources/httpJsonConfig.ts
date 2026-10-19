import { z } from 'zod';

import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import {
  type FlexMappingConfig,
  FlexMappingConfigSchema,
} from '../flexMapping/flexMappingConfig.js';
import { ptBRHttpJsonConfig } from './ptBRHttpJsonConfig.js';
import { isReadableWebAddress, parseWebAddress } from './webAddressParsing.js';

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

// The headers Node's fetch (undici) manages itself, written in lower case. A request that
// sets one makes fetch throw before sending (UND_ERR_INVALID_ARG, UND_ERR_NOT_SUPPORTED for
// Expect), which would read as a network failure at every poll. Operators paste them from
// the browser's devtools (Connection: keep-alive), so they are refused at save instead.
const headerNamesFetchSetsItself = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'expect',
]);

// A line break or NUL in a header value would let one value write a second header.
const lineBreakOrNulPattern = /[\r\n\0]/;

// What Node's fetch lets into a header value: tab, the visible ASCII and space, and the
// rest of Latin-1. Anything else (an emoji, "ł", a control character) makes fetch throw
// before sending, which would read as a network failure at every poll.
const headerValueCharactersPattern = /^[\t\x20-\x7e\x80-\xff]*$/;

/**
 * One header or query parameter: its name and exactly one of `value` (sent as written)
 * or `valueFromEnvironment` (the name of a BAJAOVRLAY_SOURCE_ variable the server reads
 * at poll time, for a token). One strict object checked by hand rather than a union, so
 * a refusal names the field that is wrong instead of listing both forms.
 */
const NameAndValueFields = {
  name: textFieldNamed('name'),
  value: textFieldNamed('value').optional(),
  valueFromEnvironment: textFieldNamed('valueFromEnvironment').optional(),
};

/** A header of a request: a token name, and a value fetch can send as it is. */
export const HttpJsonHeaderSchema = z
  .strictObject(NameAndValueFields, { error: explainProblemOfHeaderObject })
  .superRefine((header, context) => {
    if (!headerNamePattern.test(header.name)) {
      context.addIssue({
        code: 'custom',
        path: ['name'],
        message: ptBRHttpJsonConfig.badHeaderName(header.name),
      });
      return;
    }
    const isAHeaderFetchSetsItself = headerNamesFetchSetsItself.has(header.name.toLowerCase());
    if (isAHeaderFetchSetsItself) {
      context.addIssue({
        code: 'custom',
        path: ['name'],
        message: ptBRHttpJsonConfig.headerControlledByTheServer(header.name),
      });
      return;
    }
    checkExactlyOneValueOrVariable(header, context);
    checkVariableHasTheSourcePrefix(header, context);
    checkTypedHeaderValueCanBeSent(header, context);
  });

/** One header after it has passed HttpJsonHeaderSchema. */
export type HttpJsonHeader = z.infer<typeof HttpJsonHeaderSchema>;

/** A query parameter of a request: any name that is not empty (the URL encodes it). */
export const HttpJsonQueryParameterSchema = z
  .strictObject(NameAndValueFields, { error: explainProblemOfQueryParameterObject })
  .superRefine((queryParameter, context) => {
    if (queryParameter.name.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['name'],
        message: ptBRHttpJsonConfig.emptyParameterName,
      });
      return;
    }
    checkExactlyOneValueOrVariable(queryParameter, context);
    checkVariableHasTheSourcePrefix(queryParameter, context);
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
    requestId: textFieldNamed('requestId').superRefine((requestId, context) => {
      if (!requestIdPattern.test(requestId)) {
        context.addIssue({ code: 'custom', message: ptBRHttpJsonConfig.badRequestId(requestId) });
      }
    }),
    /**
     * An http:// or https:// address with no user or password in it: those would be a
     * secret in state, the event log and every browser. No address filter: see the
     * adapter's README.
     */
    url: textFieldNamed('url').superRefine((url, context) => {
      if (!isHttpOrHttpsAddress(url)) {
        context.addIssue({ code: 'custom', message: ptBRHttpJsonConfig.urlNotHttp(url) });
        return;
      }
      if (hasAUserOrPasswordInIt(url)) {
        context.addIssue({ code: 'custom', message: ptBRHttpJsonConfig.urlWithCredentials });
      }
    }),
    headers: z.array(HttpJsonHeaderSchema, { error: explainListProblem('headers') }).default([]),
    queryParameters: z
      .array(HttpJsonQueryParameterSchema, { error: explainListProblem('queryParameters') })
      .default([]),
  },
  { error: explainProblemOfRequestObject },
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
  .strictObject(
    {
      requests: z
        .array(HttpJsonRequestSchema, { error: explainListProblem('requests') })
        .min(1, { error: ptBRHttpJsonConfig.noRequest })
        .max(mostRequestsPerHttpJsonSource, {
          error: ptBRHttpJsonConfig.tooManyRequests(mostRequestsPerHttpJsonSource),
        }),
      mappings: FlexMappingConfigSchema,
    },
    { error: explainProblemOfConfigObject },
  )
  .superRefine((config, context) => {
    checkRequestIdsOfConfig(config.requests, config.mappings, context);
  });

/** A flex source's config after it has passed HttpJsonConfigSchema. */
export type HttpJsonConfig = z.infer<typeof HttpJsonConfigSchema>;

/**
 * A text field whose refusal, when it is missing or holds something else (requestId: 5),
 * is a pt-BR sentence naming the field instead of Zod's English default.
 */
function textFieldNamed(fieldName: string) {
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
function explainListProblem(fieldName: string) {
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

/** Tells whether text parses as an address whose protocol is http or https. */
function isHttpOrHttpsAddress(text: string): boolean {
  if (!isReadableWebAddress(text)) {
    return false;
  }
  const protocol = parseWebAddress(text).protocol;
  return protocol === 'http:' || protocol === 'https:';
}

/**
 * Tells whether an address carries a user or a password (http://usuario:senha@host/).
 * Besides being a secret in the config, Node's fetch refuses such an address before
 * sending it, which would read as a network failure.
 */
function hasAUserOrPasswordInIt(address: string): boolean {
  const parsedAddress = parseWebAddress(address);
  return parsedAddress.username !== '' || parsedAddress.password !== '';
}

/** Gives the pt-BR sentence for a whole config that is not an object or has a misspelt key. */
function explainProblemOfConfigObject(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'unrecognized_keys') {
    return ptBRHttpJsonConfig.unknownKeysInConfig(issue.keys);
  }
  if (issue.code === 'invalid_type') {
    return ptBRHttpJsonConfig.configNotAnObject;
  }
  return undefined;
}

/** Gives the pt-BR sentence for a request that is not an object or has a misspelt key (or "method"). */
function explainProblemOfRequestObject(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'unrecognized_keys') {
    return ptBRHttpJsonConfig.unknownKeysInRequest(issue.keys);
  }
  if (issue.code === 'invalid_type') {
    return ptBRHttpJsonConfig.requestNotAnObject;
  }
  return undefined;
}

/** Gives the pt-BR sentence for a header that is not an object or has a misspelt key. */
function explainProblemOfHeaderObject(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'unrecognized_keys') {
    return ptBRHttpJsonConfig.unknownKeysInHeader(readNameWritten(issue.input), issue.keys);
  }
  if (issue.code === 'invalid_type') {
    return ptBRHttpJsonConfig.headerNotAnObject;
  }
  return undefined;
}

/** Gives the pt-BR sentence for a query parameter that is not an object or has a misspelt key. */
function explainProblemOfQueryParameterObject(issue: z.core.$ZodRawIssue): string | undefined {
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

/** The fields a header and a query parameter share, as their checks read them. */
type NameAndValue = {
  name: string;
  value?: string | undefined;
  valueFromEnvironment?: string | undefined;
};

/** Checks that a header or query parameter has exactly one of value and valueFromEnvironment. */
function checkExactlyOneValueOrVariable(
  nameAndValue: NameAndValue,
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
  }
}

/**
 * Checks that a variable a header or query parameter names has the BAJAOVRLAY_SOURCE_
 * prefix: the rule that keeps every other server secret from being sent to an address.
 */
function checkVariableHasTheSourcePrefix(
  nameAndValue: NameAndValue,
  context: z.RefinementCtx,
): void {
  const variableName = nameAndValue.valueFromEnvironment;
  if (variableName === undefined) {
    return;
  }
  if (!sourceEnvironmentVariableNamePattern.test(variableName)) {
    context.addIssue({
      code: 'custom',
      path: ['valueFromEnvironment'],
      message: ptBRHttpJsonConfig.environmentVariableNotAllowed(variableName),
    });
  }
}

/**
 * Checks that a header's typed value has no line break (which would write a second
 * header) and no character fetch refuses (which would fail every poll as a network
 * error). A variable's value is checked the same way by the adapter at poll time.
 */
function checkTypedHeaderValueCanBeSent(header: NameAndValue, context: z.RefinementCtx): void {
  const typedValue = header.value;
  if (typedValue === undefined) {
    return;
  }
  if (lineBreakOrNulPattern.test(typedValue)) {
    context.addIssue({
      code: 'custom',
      path: ['value'],
      message: ptBRHttpJsonConfig.headerValueWithLineBreak(header.name),
    });
    return;
  }
  if (!headerValueCharactersPattern.test(typedValue)) {
    context.addIssue({
      code: 'custom',
      path: ['value'],
      message: ptBRHttpJsonConfig.headerValueWithCharacterHttpRefuses(header.name),
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
