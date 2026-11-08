import { createHmac, timingSafeEqual } from 'node:crypto';

/** The cookie that carries an operator's session (BAJAOVRLAY-29). */
export const sessionCookieName = 'bajaovrlay_sessao';

/** How long a session lasts: 18 hours, an event day from the first call to the last clear. */
export const sessionLengthInMilliseconds = 18 * 60 * 60 * 1000;

// The cookie's own lifetime, in seconds, matching the session's.
const sessionLengthInSeconds = sessionLengthInMilliseconds / 1000;

/** The signature of a session id: HMAC-SHA256 with the key kept in the database. */
function signatureOf(sessionId: string, signingKey: string): string {
  return createHmac('sha256', signingKey).update(sessionId).digest('base64url');
}

/**
 * The cookie's value for a session: its id, a dot, and the id's signature. The id alone is
 * already unguessable (a random UUID); the signature lets the server refuse a made-up
 * value before it looks the id up, as the brief asks.
 */
export function buildSignedSessionCookieValue(sessionId: string, signingKey: string): string {
  return `${sessionId}.${signatureOf(sessionId, signingKey)}`;
}

/**
 * The session id a cookie value carries, when its signature is the server's; undefined
 * for anything else. The signatures are compared in constant time, so a forger learns
 * nothing from how long a refusal takes.
 */
export function readSessionIdOfSignedCookieValue(
  cookieValue: string,
  signingKey: string,
): string | undefined {
  const positionOfTheDot = cookieValue.lastIndexOf('.');
  if (positionOfTheDot <= 0) {
    return undefined;
  }
  const sessionId = cookieValue.slice(0, positionOfTheDot);
  const presentedSignature = Buffer.from(cookieValue.slice(positionOfTheDot + 1));
  const expectedSignature = Buffer.from(signatureOf(sessionId, signingKey));
  const isSameLength = presentedSignature.length === expectedSignature.length;
  if (!isSameLength || !timingSafeEqual(presentedSignature, expectedSignature)) {
    return undefined;
  }
  return sessionId;
}

/**
 * The value of the session cookie in a request's Cookie header, or undefined when there is
 * none. Read by hand rather than with Hono's helper because the WebSocket upgrade, which
 * needs it too, arrives as Node's own request, outside Hono.
 */
export function readSessionCookieValueFromCookieHeader(
  cookieHeader: string | undefined,
): string | undefined {
  if (cookieHeader === undefined) {
    return undefined;
  }
  for (const cookiePair of cookieHeader.split(';')) {
    const positionOfTheEquals = cookiePair.indexOf('=');
    if (positionOfTheEquals === -1) {
      continue;
    }
    const cookieName = cookiePair.slice(0, positionOfTheEquals).trim();
    if (cookieName === sessionCookieName) {
      return cookiePair.slice(positionOfTheEquals + 1).trim();
    }
  }
  return undefined;
}

/**
 * The Set-Cookie header of a login. HttpOnly: no page script can read it. SameSite=Strict:
 * no other site's page can make the browser send it. Not Secure: the studio LAN serves the
 * page over plain http, where a Secure cookie would never be sent back (docs/login.md says
 * so; HTTPS is out of scope).
 */
export function buildSessionSetCookieHeader(cookieValue: string): string {
  return `${sessionCookieName}=${cookieValue}; Max-Age=${String(sessionLengthInSeconds)}; Path=/; HttpOnly; SameSite=Strict`;
}

/** The Set-Cookie header of "Sair": the same cookie, empty and already expired. */
export function buildSessionClearingSetCookieHeader(): string {
  return `${sessionCookieName}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;
}
