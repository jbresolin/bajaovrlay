// One GET to the YouTube Data API v3, and its refusals in pt-BR. The API key travels in
// the address (`key=`), as Google asks for an API key, so the address is a secret here: it
// goes to fetch and, redacted, to the debug log, and nowhere else.
import type { ServerLogger } from '../../../../core/logger/createLogger.js';
import { ptBR } from '../../../../core/messages/ptBR.js';

/** Where the YouTube Data API v3 answers; tests point the adapter at a local fake. */
export const youTubeDataApiBaseUrl = 'https://www.googleapis.com/youtube/v3';

/** What one request needs. The key is read by the caller at this request, never kept. */
export type YouTubeApiRequest = {
  baseUrl: string;
  /** "videos" or "liveChat/messages". */
  path: string;
  parameters: Array<[string, string]>;
  apiKey: string;
  signal: AbortSignal;
  logger: ServerLogger;
};

/**
 * The parsed answer, or the pt-BR reason it failed with Google's reason word
 * ("liveChatEnded"), which the adapter reads to know whether the chat is gone.
 */
export type YouTubeApiAnswer =
  { ok: true; body: unknown } | { ok: false; error: string; reason: string | undefined };

/**
 * The address with the value of every `key=` parameter replaced by `***`: the only form
 * of a YouTube address that may be logged. Works on the text, so it also redacts an
 * address that is not a valid URL.
 */
export function redactTheKeyInAnAddress(address: string): string {
  return address.replace(/([?&]key=)[^&#]*/g, '$1***');
}

/**
 * GETs one YouTube API address and reads its JSON. Never throws: a refusal, no connection
 * or an answer that is not JSON is a pt-BR error. A signalled request rejects with the
 * signal's own error instead, so the poller records its "Tempo esgotado".
 * The log line carries the redacted address and the status, never the key.
 */
export async function fetchYouTubeApi(request: YouTubeApiRequest): Promise<YouTubeApiAnswer> {
  const address = new URL(`${request.baseUrl}/${request.path}`);
  for (const [name, value] of request.parameters) {
    address.searchParams.set(name, value);
  }
  address.searchParams.set('key', request.apiKey);
  const addressToLog = redactTheKeyInAnAddress(address.toString());

  let response: Response;
  try {
    response = await fetch(address, { method: 'GET', signal: request.signal, redirect: 'manual' });
  } catch (fetchError) {
    if (request.signal.aborted) {
      throw fetchError;
    }
    request.logger.debug({ address: addressToLog }, 'youtube request failed to connect');
    return { ok: false, error: ptBR.youTube.noConnection, reason: undefined };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (request.signal.aborted) {
      throw request.signal.reason;
    }
    request.logger.debug(
      { address: addressToLog, status: response.status },
      'youtube answer not JSON',
    );
    return { ok: false, error: ptBR.youTube.answerNotUnderstood, reason: undefined };
  }
  request.logger.debug(
    { address: addressToLog, status: response.status },
    'youtube request answered',
  );

  if (response.ok) {
    return { ok: true, body };
  }
  const reason = readGoogleErrorReason(body);
  return { ok: false, error: describeYouTubeRefusal(response.status, reason), reason };
}

/**
 * Google's reason word of a refusal: `error.errors[0].reason` ("liveChatEnded"), or
 * `error.status` when the first is missing, or undefined.
 */
function readGoogleErrorReason(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return undefined;
  }
  const googleError = body.error;
  if (typeof googleError !== 'object' || googleError === null) {
    return undefined;
  }
  if ('errors' in googleError && Array.isArray(googleError.errors)) {
    const firstError: unknown = googleError.errors[0];
    if (typeof firstError === 'object' && firstError !== null && 'reason' in firstError) {
      return String(firstError.reason);
    }
  }
  if ('status' in googleError && typeof googleError.status === 'string') {
    return googleError.status;
  }
  return undefined;
}

/**
 * The operator's sentence for a refusal. Google's own message is never shown: it is in
 * English, and some name the request. A reason not listed here is named by its word.
 */
function describeYouTubeRefusal(httpStatus: number, reason: string | undefined): string {
  switch (reason) {
    case 'liveChatEnded':
      return ptBR.youTube.liveChatEnded;
    case 'liveChatDisabled':
      return ptBR.youTube.liveChatDisabled;
    case 'liveChatNotFound':
      return ptBR.youTube.liveChatNotFound;
    case 'forbidden':
      return ptBR.youTube.liveChatForbidden;
    case 'quotaExceeded':
    case 'dailyLimitExceeded':
      return ptBR.youTube.googleQuotaExceeded;
    case 'rateLimitExceeded':
      return ptBR.youTube.rateLimited;
    case 'keyInvalid':
    case 'badRequest':
    case 'accessNotConfigured':
    case 'ipRefererBlocked':
    case 'API_KEY_INVALID':
    case 'PERMISSION_DENIED':
      return ptBR.youTube.apiKeyRefused;
    default:
      return ptBR.youTube.otherRefusal(httpStatus, reason ?? 'sem motivo');
  }
}
