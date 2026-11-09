/**
 * How a Super Chat reads on the page, with no car (apps/control)
 *
 * What this module is for:
 *   Every race event is about one car, and the page names it by its car ("Penalidade ·
 *   carro 47"). A viewer's Super Chat (BAJAOVRLAY-35) is about no car, so the same places
 *   name it by its viewer and amount: the "Desfazer" line under the waiting events,
 *   Camadas' mark on the notice it put on air, and the history's details, where the search
 *   finds the viewer and the message.
 *
 * What these tests prove, one row per kind of event:
 *   - A race event is named by its car; a Super Chat by its viewer and amount.
 *   - Camadas' mark reads "evento: super chat · Torcida Pequi Off-Road · R$ 20,00".
 *   - The history's details of a Super Chat are its viewer, amount and message; an empty
 *     message adds nothing.
 *
 * What these tests deliberately do not cover:
 *   - The rows and their buttons; SuperChatModeration.test.tsx.
 */
import type { InboxEvent } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildPendingPenaltyOfCar47 } from '@/state/eventsLikeTheServerSends.testSupport';
import {
  buildSuperChatOfTorcidaPequiAwaitingApproval,
  buildSuperChatWithoutAMessageAwaitingApproval,
} from '@/state/superChatsLikeTheServerSends.testSupport';

import {
  describeDetailsOfEvent,
  describeEventMarkOnLayer,
  describeSubjectOfEvent,
} from './inboxEventText';

const subjectScenarios: Array<{ name: string; event: InboxEvent; subject: string }> = [
  // A penalty is about car 47.
  { name: 'names a penalty by its car', event: buildPendingPenaltyOfCar47(5), subject: 'carro 47' },
  // A viewer's message is about no car: who paid, and how much.
  {
    name: 'names a Super Chat by its viewer and amount',
    event: buildSuperChatOfTorcidaPequiAwaitingApproval(2),
    subject: 'Torcida Pequi Off-Road · R$ 20,00',
  },
];

describe('who an event is about', () => {
  it.each(subjectScenarios)('$name', ({ event, subject }) => {
    // Arrange: the event (in the table).

    // Act: name who it is about.
    const subjectText = describeSubjectOfEvent(event);

    // Assert: the car, or the viewer and amount.
    expect(subjectText, 'the subject the page names the event by').toBe(subject);
  });
});

describe('Camadas’ mark of a Super Chat on air', () => {
  it('reads its viewer and amount instead of a car', () => {
    // Arrange: Torcida Pequi's message.
    const superChat = buildSuperChatOfTorcidaPequiAwaitingApproval(2);

    // Act: write the mark of the notice it put on air.
    const mark = describeEventMarkOnLayer(superChat);

    // Assert: kind, viewer and amount.
    expect(mark, 'the mark on the layer').toBe(
      'evento: super chat · Torcida Pequi Off-Road · R$ 20,00',
    );
  });
});

describe('the history’s details of a Super Chat', () => {
  it('are its viewer, amount and message', () => {
    // Arrange: Torcida Pequi's message.
    const superChat = buildSuperChatOfTorcidaPequiAwaitingApproval(2);

    // Act: write its details.
    const details = describeDetailsOfEvent(superChat);

    // Assert: the three joined, so the search finds any of them.
    expect(details, 'the details of a Super Chat').toBe(
      'Torcida Pequi Off-Road · R$ 20,00 · Vai, Pequi! Abraço de Goiânia',
    );
  });

  it('leave out an empty message', () => {
    // Arrange: Ana do Paddock's R$ 5,00 with no message.
    const superChat = buildSuperChatWithoutAMessageAwaitingApproval(1);

    // Act: write its details.
    const details = describeDetailsOfEvent(superChat);

    // Assert: no trailing separator.
    expect(details, 'an empty message adds nothing').toBe('Ana do Paddock · R$ 5,00');
  });
});
