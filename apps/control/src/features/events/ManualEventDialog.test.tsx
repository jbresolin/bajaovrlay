/**
 * "+ Evento": an event typed by the operator (apps/control)
 *
 * What this module is for:
 *   A penalty the race direction announced on the radio, or a notice about a car, may
 *   reach the inbox by hand (BAJAOVRLAY-44): "+ Evento" on the "Eventos" page opens a form
 *   with the kind (Penalidade or Aviso), the car number, the team and school (optional:
 *   the server reads them from the sources when left blank), the reason and, for a
 *   penalty, the penalty itself. "Criar evento" sends createManualEvent; the event then
 *   waits in the inbox like any other.
 *
 * What these tests prove:
 *   - A penalty typed for car 47 is sent as createManualEvent, team and school left out,
 *     and the form closes once the server accepts it.
 *   - A notice for car 12 with its school typed is sent with the school.
 *   - A car that is not a whole number and an empty reason are refused on the page in
 *     pt-BR, and nothing is sent.
 *
 * What these tests deliberately do not cover:
 *   - Filling the team and school from the sources; the server's inboxCommandsOnTheStore.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { chooseOptionInDropdown } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import {
  letThePageFinishWhatItStarted,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheInbox } from '@/state/eventsLikeTheServerSends.testSupport';

import { EventReviewPage } from './EventReviewPage';

/** The "Eventos" page, with "+ Evento" pressed. */
function openTheManualEventForm() {
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <EventReviewPage />,
    buildSlicesWithTheInbox([]),
  );
  fireEvent.click(screen.getByRole('button', { name: '+ Evento' }));
  return controlPage;
}

/** Types a text into the form's field of this label. */
function typeInto(fieldLabel: string, text: string): void {
  fireEvent.change(screen.getByLabelText(fieldLabel), { target: { value: text } });
}

describe('the "+ Evento" form', () => {
  it('sends a penalty for car 47 and closes once the server accepts it', async () => {
    // Arrange: the form, filled for car 47's refuelling penalty, team and school blank.
    const { fakeServer } = openTheManualEventForm();
    typeInto('Carro', '47');
    typeInto('Motivo', 'Reabastecimento com o motor ligado');
    typeInto('Punição', '+120 segundos');

    // Act: create it, and the server accepts.
    fireEvent.click(screen.getByRole('button', { name: 'Criar evento' }));
    fakeServer.acceptLastCommand();
    await letThePageFinishWhatItStarted();

    // Assert: one createManualEvent, a penalty, no team or school; the form is gone.
    expect(fakeServer.listCommandsReceived(), 'the typed penalty must be sent').toEqual([
      {
        type: 'createManualEvent',
        noticeKind: 'penalty',
        carNumber: 47,
        reason: 'Reabastecimento com o motor ligado',
        penaltyText: '+120 segundos',
      },
    ]);
    expect(
      screen.queryByRole('button', { name: 'Criar evento' }),
      "the form closes on the server's ok",
    ).toBeNull();
  });

  it('sends a notice with the school typed', () => {
    // Arrange: the form set to "Aviso" for car 12, its school typed.
    const { fakeServer } = openTheManualEventForm();
    chooseOptionInDropdown('Tipo', 'Aviso');
    typeInto('Carro', '12');
    typeInto('Escola', 'UTFPR');
    typeInto('Motivo', 'Carro parado na reta dos boxes');

    // Act: create it.
    fireEvent.click(screen.getByRole('button', { name: 'Criar evento' }));

    // Assert: a notice with its school, and no penalty.
    expect(fakeServer.listCommandsReceived(), 'the typed notice must be sent').toEqual([
      {
        type: 'createManualEvent',
        noticeKind: 'notice',
        carNumber: 12,
        schoolName: 'UTFPR',
        reason: 'Carro parado na reta dos boxes',
      },
    ]);
  });

  it('refuses a car that is not a whole number and an empty reason, sending nothing', () => {
    // Arrange: the form with "47A" as the car and no reason.
    const { fakeServer } = openTheManualEventForm();
    typeInto('Carro', '47A');

    // Act: try to create it.
    fireEvent.click(screen.getByRole('button', { name: 'Criar evento' }));

    // Assert: the first problem said in pt-BR, and nothing sent.
    expect(screen.getByRole('alert').textContent, 'the page must say what is wrong').toBe(
      'Informe o número do carro, um número inteiro.',
    );
    expect(fakeServer.listCommandsReceived(), 'nothing may be sent').toEqual([]);
  });
});
