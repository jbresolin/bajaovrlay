import { z } from 'zod';

import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import {
  type FlexMappingConfig,
  FlexMappingConfigSchema,
} from '../flexMapping/flexMappingConfig.js';
import {
  explainListProblem,
  explainProblemOfConfigObject,
  explainProblemOfHeaderObject,
  explainProblemOfQueryParameterObject,
  explainProblemOfRequestObject,
  textFieldNamed,
} from './httpJsonConfigIssueSentences.js';
import { ptBRHttpJsonConfig } from './ptBRHttpJsonConfig.js';
import { isReadableWebAddress, parseWebAddress } from './webAddressParsing.js';

/** The most requests one flex source makes per poll: every one is fetched at every poll. */
export const mostRequestsPerHttpJsonSource = 5;

/**
 * The range of a request's own refresh time (BAJAOVRLAY-53). At least a minute, the
 * longest poll interval, so it is never shorter than the poll and means something; at most
 * an hour, so a list fixed during the event is never shown wrong for longer than that.
 */
export const shortestRequestRefreshMs = 60_000;
export const longestRequestRefreshMs = 3_600_000;

/**
 * The prefix every environment variable a config names must start with. The dataSources
 * slice goes to every operator connection and into the event log, so a token is never
 * written in a config: the config names a variable and the server reads it at poll time.
 * The prefix keeps the server's other variables (DATABASE_PATH, a cloud key) out of any
 * request. It does not decide where a BAJAOVRLAY_SOURCE_ secret may go: the server's
 * BAJAOVRLAY_SOURCE_ALLOWED_HOSTS does (apps/server, adapters/httpJson), and with no such
 * list no variable's value is sent at all.
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
     * secret in state, the event log and every browser. Which hosts may be fetched is
     * the server's BAJAOVRLAY_SOURCE_ALLOWED_HOSTS, checked on save and at every request
     * (see the server adapter's README), not this schema.
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
    /**
     * Fetch this request only once in this many ms, reusing its last good response at the
     * polls between (BAJAOVRLAY-53): for a list that changes once an event, joined by a
     * lookup, such as the teams. Absent, the request is fetched at every poll.
     */
    refreshEveryMs: z
      .number({ error: refreshEveryMsReason })
      .int({ error: refreshEveryMsReason })
      .min(shortestRequestRefreshMs, { error: refreshEveryMsReason })
      .max(longestRequestRefreshMs, { error: refreshEveryMsReason })
      .optional(),
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

/** The one sentence for any refresh time out of range or not a whole number of ms. */
function refreshEveryMsReason(): string {
  return ptBRHttpJsonConfig.refreshEveryMsOutOfRange(
    shortestRequestRefreshMs,
    longestRequestRefreshMs,
  );
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
 * prefix: the rule that keeps every other server variable out of a request. Where a
 * BAJAOVRLAY_SOURCE_ value may be sent is the server's host list, not this check.
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

/** Checks that request ids are unique and that every mapping and lookup reads one of the requests. */
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
    (mapping.lookups ?? []).forEach((lookup, lookupIndex) => {
      if (!requestIdsSeen.has(lookup.requestId)) {
        context.addIssue({
          code: 'custom',
          path: ['mappings', mappingIndex, 'lookups', lookupIndex, 'requestId'],
          message: ptBRHttpJsonConfig.unknownRequestInLookup(
            ptBRDataShapes.shapeNames[mapping.shapeKey],
            lookup.lookupName,
            lookup.requestId,
          ),
        });
      }
    });
  });
}
