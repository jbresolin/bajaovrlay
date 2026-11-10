/**
 * The simulator's Super Chats (apps/server)
 *
 * What this module is for:
 *   With "Simular Super Chats" on (areSuperChatsSimulated), the simulator answers the
 *   superChats shape too: a fictional viewer's paid message about every five simulated
 *   minutes, drawn from the seed, so the Super Chat flow (inbox, approval, "No ar") can be
 *   rehearsed with no live stream (BAJAOVRLAY-35).
 *
 * What these tests prove:
 *   - Off (the default), the simulator answers and lists no superChats shape; on, it does.
 *   - One hour of simulated race brings exactly twelve, ids `simulador-<seed>-superchat-<n>`.
 *   - The same seed and moment always give the same Super Chats (a restart relists none).
 *   - Every one is a fictional viewer of the catalog, in reais ("R$ 20,00"), with matching
 *     micros; the newest 20 are kept.
 *   - Each is published at its wall-clock moment: at 60×, five simulated minutes are five
 *     real seconds.
 *
 * What these tests deliberately do not cover:
 *   - The inbox listing them: the event inbox's tests.
 *   - The race itself: simulateEnduro.test.ts and the other simulator tests.
 */
import { SimulatorConfigSchema, validateDataShape } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { ptBR } from '../../../../core/messages/ptBR.js';
import { listSimulatedSuperChats } from './simulatedSuperChats.js';
import { createSimulatorAdapter } from './simulatorAdapter.js';

/** 14:00 on Saturday 14 August 2027: the green flag of the simulated enduro. */
const greenFlagMs = Date.parse('2027-08-14T14:00:00.000Z');

/** One simulated hour, in ms. */
const oneHourMs = 60 * 60_000;

/** The simulated enduro of seed 2027 at 1×, started at the green flag. */
const enduroAtNormalSpeed = { seed: 2027, speed: 1, simulatedStartAtMs: greenFlagMs };

describe('the simulator with and without Super Chats', () => {
  it('answers no superChats shape while the switch is off', async () => {
    // Arrange: the default simulator config, started at the green flag.
    const config = SimulatorConfigSchema.parse({ simulatedStartAtMs: greenFlagMs });
    const adapter = createSimulatorAdapter();

    // Act: poll one hour into the race.
    const answer = await adapter.pollOnce(config, {
      readCurrentTime: () => new Date(greenFlagMs + oneHourMs),
      signal: new AbortController().signal,
    });

    // Assert: no Super Chats answered or listed.
    expect(answer.shapes.superChats, 'off, no Super Chat may be simulated').toBeUndefined();
    expect(adapter.listProducedShapes(config), 'off, the shape must not be listed').not.toContain(
      'superChats',
    );
  });

  it('answers a valid superChats shape with the switch on', async () => {
    // Arrange: the simulator with "Simular Super Chats" on.
    const config = SimulatorConfigSchema.parse({
      simulatedStartAtMs: greenFlagMs,
      areSuperChatsSimulated: true,
    });
    const adapter = createSimulatorAdapter();

    // Act: poll one hour into the race.
    const answer = await adapter.pollOnce(config, {
      readCurrentTime: () => new Date(greenFlagMs + oneHourMs),
      signal: new AbortController().signal,
    });

    // Assert: listed, answered, and valid for the store.
    expect(adapter.listProducedShapes(config), 'on, the shape must be listed').toContain(
      'superChats',
    );
    const validation = validateDataShape('superChats', answer.shapes.superChats);
    expect(validation.isValid, 'the simulated shape must pass the canonical schema').toBe(true);
  });
});

describe('the simulated Super Chats', () => {
  it('brings exactly twelve in one simulated hour, numbered from 1', () => {
    // Arrange: the enduro at 1×.

    // Act: list them one hour in.
    const superChats = listSimulatedSuperChats(enduroAtNormalSpeed, oneHourMs);

    // Assert: twelve, the first and last with their stable ids.
    expect(superChats, 'one every five minutes is twelve an hour').toHaveLength(12);
    expect(superChats[0]?.messageId, 'the first id').toBe('simulador-2027-superchat-1');
    expect(superChats[11]?.messageId, 'the twelfth id').toBe('simulador-2027-superchat-12');
  });

  it('gives the same Super Chats for the same seed and moment', () => {
    // Arrange: the enduro at 1×.

    // Act: list them twice at the same moment, as two polls (or a restart) would.
    const firstReading = listSimulatedSuperChats(enduroAtNormalSpeed, oneHourMs);
    const secondReading = listSimulatedSuperChats(enduroAtNormalSpeed, oneHourMs);

    // Assert: identical, so no id is ever listed twice.
    expect(secondReading, 'the same moment must give the same Super Chats').toEqual(firstReading);
  });

  it('draws fictional viewers from the catalog, in reais with matching micros', () => {
    // Arrange: the catalog of viewers and amounts.
    const catalog = ptBR.youTube.simulatedSuperChats;

    // Act: list two hours of them.
    const superChats = listSimulatedSuperChats(enduroAtNormalSpeed, 2 * oneHourMs);

    // Assert: every viewer from the catalog, every amount written in reais and in micros.
    for (const superChat of superChats) {
      expect(catalog.viewerNames, 'every viewer must be a fictional one').toContain(
        superChat.authorName,
      );
      const reais = superChat.amountMicros / 1_000_000;
      expect(superChat.amountText, 'the amount must read as YouTube writes reais').toBe(
        `R$ ${String(reais)},00`,
      );
      expect(superChat.currency, 'the currency must be the real').toBe('BRL');
    }
  });

  it('keeps the newest 20', () => {
    // Arrange: the enduro at 1×.

    // Act: list three hours of them (36 published).
    const superChats = listSimulatedSuperChats(enduroAtNormalSpeed, 3 * oneHourMs);

    // Assert: the 17th to the 36th.
    expect(superChats, 'at most 20 are kept').toHaveLength(20);
    expect(superChats[0]?.messageId, 'the oldest kept must be the 17th').toBe(
      'simulador-2027-superchat-17',
    );
  });

  it('publishes each at its wall-clock moment, sped up with the race', () => {
    // Arrange: the same enduro at 60×.
    const enduroAtSixtyTimes = { ...enduroAtNormalSpeed, speed: 60 };

    // Act: list one simulated hour at 1× and at 60×.
    const atNormalSpeed = listSimulatedSuperChats(enduroAtNormalSpeed, oneHourMs);
    const atSixtyTimes = listSimulatedSuperChats(enduroAtSixtyTimes, oneHourMs);

    // Assert: the first one's real time since the start is sixty times shorter at 60×.
    const realDelayAtNormalSpeedMs = (atNormalSpeed[0]?.publishedAtMs ?? 0) - greenFlagMs;
    const realDelayAtSixtyTimesMs = (atSixtyTimes[0]?.publishedAtMs ?? 0) - greenFlagMs;
    expect(
      realDelayAtSixtyTimesMs,
      'at 60×, the first Super Chat must come sixty times sooner',
    ).toBe(Math.round(realDelayAtNormalSpeedMs / 60));
  });
});
