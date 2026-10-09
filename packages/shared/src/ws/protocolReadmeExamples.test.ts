/**
 * The WS protocol examples stay true (packages/shared)
 *
 * What this module is for:
 *   packages/shared/src/ws/README.md shows one JSON example of every WebSocket
 *   message. People building a client copy those examples, so they must be valid.
 *
 * What these tests prove:
 *   - The README has at least one example of each of the five message shapes
 *     (hello, slice, command, ok commandResult, error commandResult).
 *   - Every example passes the schema for its direction: `command` the client schema,
 *     everything else the server schema.
 *
 * What these tests deliberately do not cover:
 *   - Whether the prose around the examples is accurate; that is a review judgement.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ClientMessageSchema } from './clientMessages.js';
import { ServerMessageSchema } from './serverMessages.js';

const protocolReadmePath = new URL('./README.md', import.meta.url);

/** Returns the parsed body of every ```json code block in a Markdown document, in order. */
function readEveryJsonCodeBlock(markdown: string): unknown[] {
  const blockStartMarker = '```json\n';
  const blockEndMarker = '\n```';
  const parsedBlocks: unknown[] = [];
  let searchFrom = 0;
  while (markdown.indexOf(blockStartMarker, searchFrom) !== -1) {
    const blockStart = markdown.indexOf(blockStartMarker, searchFrom) + blockStartMarker.length;
    const blockEnd = markdown.indexOf(blockEndMarker, blockStart);
    parsedBlocks.push(JSON.parse(markdown.slice(blockStart, blockEnd)));
    searchFrom = blockEnd + blockEndMarker.length;
  }
  return parsedBlocks;
}

/** Names an example by its shape, telling the two kinds of commandResult apart. */
function describeMessageShape(example: unknown): string {
  const exampleAsRecord = example as { type?: unknown; ok?: unknown };
  if (exampleAsRecord.type === 'commandResult') {
    return exampleAsRecord.ok === true ? 'commandResult ok' : 'commandResult error';
  }
  return String(exampleAsRecord.type);
}

describe('packages/shared/src/ws/README.md', () => {
  it('shows one example of each of the five message shapes', () => {
    // Arrange: read the README from disk.
    const readme = readFileSync(protocolReadmePath, 'utf8');

    // Act: collect the shape of every JSON example in it.
    const shapesShown = readEveryJsonCodeBlock(readme).map(describeMessageShape);

    // Assert: every shape appears.
    expect(new Set(shapesShown), 'every message shape must have an example').toEqual(
      new Set(['hello', 'slice', 'command', 'commandResult ok', 'commandResult error']),
    );
  });

  it('shows only examples that pass the schema for their direction', () => {
    // Arrange: read the README and parse its JSON examples.
    const examples = readEveryJsonCodeBlock(readFileSync(protocolReadmePath, 'utf8'));

    // Act: check each example against the schema of the side that sends it.
    const examplesThatFailTheirSchema = examples.filter((example) => {
      const isSentByAClient = describeMessageShape(example) === 'command';
      const schemaForItsDirection = isSentByAClient ? ClientMessageSchema : ServerMessageSchema;
      return !schemaForItsDirection.safeParse(example).success;
    });

    // Assert: none fails.
    expect(examplesThatFailTheirSchema, 'every README example must be a valid message').toEqual([]);
  });
});
