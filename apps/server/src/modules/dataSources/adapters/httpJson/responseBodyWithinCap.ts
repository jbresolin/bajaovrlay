// Reading a response body as a stream, up to a cap, so an endpoint that answers far too
// much (or never stops answering) cannot fill the server's memory.

/** The most a flex source's response may be: 5 MB, counted in bytes as they arrive. */
export const largestResponseBodyInBytes = 5_000_000;

/** The body as text with its size in bytes, or the news that it went past the cap (and was dropped there). */
export type ResponseBodyReading =
  { isWithinCap: true; text: string; bytesRead: number } | { isWithinCap: false };

// TextDecoder drops a leading byte-order mark (U+FEFF), as Response.json() does; Buffer's
// toString keeps it, and JSON.parse then refuses a good body. Timing software written for
// Windows often starts its JSON with one. Bytes that are not UTF-8 become U+FFFD either way.
const utf8Decoder = new TextDecoder('utf-8');

/**
 * Reads the body chunk by chunk and stops as soon as the bytes read pass `capInBytes`,
 * cancelling the rest of the stream (which closes the connection), so at most one chunk
 * past the cap is ever held. A body of exactly the cap is read whole. The text is decoded
 * as UTF-8, which JSON over HTTP is, without a leading byte-order mark. A stream that fails mid-way (the connection dropped,
 * the poll's signal fired) rejects with that stream's error, for the caller to word.
 */
export async function readResponseBodyWithinCap(
  body: ReadableStream<Uint8Array> | null,
  capInBytes: number,
): Promise<ResponseBodyReading> {
  if (body === null) {
    return { isWithinCap: true, text: '', bytesRead: 0 };
  }

  const reader = body.getReader();
  const chunksRead: Uint8Array[] = [];
  let bytesRead = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    bytesRead += value.byteLength;
    if (bytesRead > capInBytes) {
      await reader.cancel();
      return { isWithinCap: false };
    }
    chunksRead.push(value);
  }

  const text = utf8Decoder.decode(Buffer.concat(chunksRead));
  return { isWithinCap: true, text, bytesRead };
}
