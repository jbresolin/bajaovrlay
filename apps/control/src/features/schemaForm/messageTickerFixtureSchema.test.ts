/**
 * The message ticker's test fixture against its real manifest (apps/control)
 *
 * What this module is for:
 *   The form's tests of a list of texts run against a copy of the ticker's data schema,
 *   written out in messageTickerFixtureSchema.testSupport.ts so a reader sees it. A copy
 *   can drift: at gate 2 it had lost the label's 10-character limit and the 9-message
 *   limit, so the form's tests no longer proved what the operator meets.
 *
 * What these tests prove:
 *   - The fixture's label and messages are exactly the real manifest's, word for word,
 *     limits and pattern included.
 *
 * What these tests deliberately do not cover:
 *   - The clock switch: the fixture keeps its own default (on), which the form's tests
 *     read; the real default (off) is the ticker package's to test.
 *   - What the form does with the schema; schemaFormTextList.test.ts.
 */
import messageTickerManifest from '@bajaovrlay/message-ticker/message-ticker.ograf.json';
import { describe, expect, it } from 'vitest';

import { buildMessageTickerFixtureDataSchema } from './messageTickerFixtureSchema.testSupport';

describe('the message ticker fixture', () => {
  it('declares the label and the messages exactly as the real manifest does', () => {
    // Arrange: the real manifest's properties, and the fixture's.
    const realProperties = messageTickerManifest.schema.properties;
    const fixtureProperties = buildMessageTickerFixtureDataSchema().properties as Record<
      string,
      unknown
    >;

    // Act: pick the two fields the form's list tests read from each.
    const fixtureLabelAndMessages = {
      label: fixtureProperties.label,
      messages: fixtureProperties.messages,
    };
    const realLabelAndMessages = {
      label: realProperties.label,
      messages: realProperties.messages,
    };

    // Assert: they are the same, so a change to the manifest must be copied here.
    expect(
      fixtureLabelAndMessages,
      'the fixture’s label and messages must equal the real manifest’s',
    ).toEqual(realLabelAndMessages);
  });
});
