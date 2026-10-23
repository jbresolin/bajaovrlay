/**
 * The id of a new person, sponsor or schedule slot, made on the page: a version-4 UUID
 * built from crypto.getRandomValues. Not crypto.randomUUID, which browsers offer only on
 * https or localhost: a tablet at the event opens the page over plain http on the LAN,
 * and calling it there blanked Cadastros (gate 2 of PR #23). getRandomValues is offered
 * on every address (state/serverConnection.ts avoids randomUUID for the same reason).
 */
export function makeRecordId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // RFC 9562, version 4: the version in the high half of byte 6, the variant in byte 8.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
