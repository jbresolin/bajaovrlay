// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/super-chat)
 *
 * What this module is for:
 *   super-chat.ograf.json describes the card's data as JSON Schema, for renderers and for
 *   the control page's generated form; superChatModel.ts checks the same data with Zod when
 *   `load` and `updateAction` receive it. If the two disagreed, the form could offer a value
 *   the graphic refuses, or refuse one it would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: a complete Super Chat, one with an empty
 *     message and one with none; a missing amount or author, an empty amount or author, an
 *     unknown field, and a message that is not text.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest; superChatManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (the pragma on line 1); it draws nothing.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import superChatManifest from '../super-chat.ograf.json';
import { parseCompleteSuperChatData, type SuperChatData } from './superChatModel.js';

/** Builds Torcida Pequi Off-Road's R$ 20,00 Super Chat from Goiânia. */
function createPequiSuperChatData(): SuperChatData {
  return {
    amountText: 'R$ 20,00',
    authorName: 'Torcida Pequi Off-Road',
    messageText: 'Vai, Pequi! Abraço de Goiânia',
  };
}

const dataAgreementScenarios = [
  // The everyday Super Chat must pass both checks.
  { name: 'both accept a complete Super Chat', data: createPequiSuperChatData(), isValid: true },
  // A viewer who paid without writing: YouTube sends an empty comment.
  {
    name: 'both accept an empty message',
    data: { ...createPequiSuperChatData(), messageText: '' },
    isValid: true,
  },
  // The message really is optional in both.
  {
    name: 'both accept no message at all',
    data: { amountText: 'R$ 5,00', authorName: 'Ana do Paddock' },
    isValid: true,
  },
  // The amount is required in both.
  {
    name: 'both refuse data without the amount',
    data: { ...createPequiSuperChatData(), amountText: undefined },
    isValid: false,
  },
  // The author is required in both.
  {
    name: 'both refuse data without the author',
    data: { ...createPequiSuperChatData(), authorName: undefined },
    isValid: false,
  },
  // An empty amount is no amount: the head would show an empty navy cell.
  {
    name: 'both refuse an empty amount',
    data: { ...createPequiSuperChatData(), amountText: '' },
    isValid: false,
  },
  // An empty author is no author.
  {
    name: 'both refuse an empty author',
    data: { ...createPequiSuperChatData(), authorName: '' },
    isValid: false,
  },
  // A typo'd field name must fail both.
  {
    name: 'both refuse an unknown field',
    data: { ...createPequiSuperChatData(), message: 'Vai, Pequi!' },
    isValid: false,
  },
  // A message must be text; a number would be a binding to the wrong field.
  {
    name: 'both refuse a message that is not text',
    data: { ...createPequiSuperChatData(), messageText: 20 },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator; JSON drops
    // undefined fields, exactly as they would be dropped on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(superChatManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteSuperChatData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
