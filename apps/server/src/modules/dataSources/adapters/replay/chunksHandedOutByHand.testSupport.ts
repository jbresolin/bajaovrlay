// Test support: a stream of text the test hands out a chunk at a time, by hand, and that
// counts how many chunks it was asked for. It stands in for a file read stream, so a
// test can stop between two chunks and look at what the reader did with the first one,
// with no clock and no file involved.

/** A stream of text chunks the test hands out by hand. */
export type ChunksHandedOutByHand = {
  /** What the reader reads: each chunk arrives only when the test hands it out. */
  chunks: AsyncIterable<string>;
  /** Answers the reader's waiting ask with the next chunk. */
  handOutTheNextChunk: (chunkText: string) => void;
  /** Answers the reader's waiting ask with the end of the stream. */
  endTheStream: () => void;
  /** How many times the reader has asked for a chunk (or the end) so far. */
  countTheChunksAskedFor: () => number;
};

/**
 * Builds a stream that hands out nothing until the test does. Handing out a chunk the
 * reader has not asked for yet throws: the test is then wrong about what the reader does,
 * and must say so instead of buffering the chunk out of sight.
 */
export function createChunksHandedOutByHand(): ChunksHandedOutByHand {
  let chunksAskedFor = 0;
  let answerTheWaitingAsk: ((result: IteratorResult<string>) => void) | undefined;

  function answerTheAsk(result: IteratorResult<string>): void {
    if (answerTheWaitingAsk === undefined) {
      throw new Error('the reader has not asked for a chunk yet');
    }
    const answer = answerTheWaitingAsk;
    answerTheWaitingAsk = undefined;
    answer(result);
  }

  const chunks: AsyncIterable<string> = {
    [Symbol.asyncIterator]() {
      return {
        next() {
          chunksAskedFor += 1;
          return new Promise<IteratorResult<string>>((resolve) => {
            answerTheWaitingAsk = resolve;
          });
        },
      };
    },
  };

  return {
    chunks,
    handOutTheNextChunk: (chunkText) => {
      answerTheAsk({ value: chunkText, done: false });
    },
    endTheStream: () => {
      answerTheAsk({ value: undefined, done: true });
    },
    countTheChunksAskedFor: () => chunksAskedFor,
  };
}
