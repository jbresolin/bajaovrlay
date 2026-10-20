/**
 * The correction dialog (apps/control)
 *
 * What this module is for:
 *   "Corrigir valor…" (Fontes) and "Corrigir valor da fonte…" (Edição rápida) open one
 *   dialog: what is corrected, the value now, the corrected value (a dropdown for a flag,
 *   a status or a kind of session, a number for points and durations, text otherwise),
 *   and the reason, required. "Salvar correção" sends setOverride; "Remover correção",
 *   shown when a correction is in force, sends clearOverride.
 *
 * What these tests prove:
 *   - A flag correction is chosen from the flags and sent as setOverride.
 *   - Points typed with a decimal comma are sent as a number.
 *   - A blank reason, or a value the field cannot hold, is refused in the dialog and
 *     nothing is sent.
 *   - "Remover correção" sends clearOverride for the correction in force.
 *
 * What these tests deliberately do not cover:
 *   - Where the dialog is opened from; the Edição rápida and Fontes tests.
 */
import type { Override } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { OverrideDialog } from './OverrideDialog';

/** Draws the dialog open on a connected page, correcting the key given. */
function renderDialogFor(props: {
  overrideKey: Parameters<typeof OverrideDialog>[0]['overrideKey'];
  overrideInForce?: Override;
}) {
  const onClose = vi.fn();
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <OverrideDialog
      isOpen
      onClose={onClose}
      sourceLabel="Simulador — Enduro"
      overrideKey={props.overrideKey}
      overrideInForce={props.overrideInForce}
      valueNowText="Verde"
    />,
    buildSlicesWithNothingOnAir(),
  );
  return { ...controlPage, onClose, dialog: within(screen.getByRole('dialog')) };
}

describe('OverrideDialog', () => {
  it('sends a flag correction chosen from the flags', async () => {
    // Arrange: the dialog for the session flag.
    const { fakeServer, dialog } = renderDialogFor({
      overrideKey: { sourceId: 'simulador-enduro', scope: 'session', field: 'state' },
    });

    // Act: choose the yellow flag, give the reason and save.
    fireEvent.keyDown(dialog.getByRole('combobox', { name: 'Valor corrigido' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Amarela' }));
    fireEvent.change(dialog.getByLabelText('Motivo (obrigatório)'), {
      target: { value: 'O diretor de prova deu amarela.' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Salvar correção' }));

    // Assert: the flag value the shapes use, not its label.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the flag correction').toEqual([
        {
          type: 'setOverride',
          sourceId: 'simulador-enduro',
          scope: 'session',
          field: 'state',
          value: 'yellow',
          reason: 'O diretor de prova deu amarela.',
        },
      ]);
    });
  });

  it('sends points typed with a decimal comma as a number', async () => {
    // Arrange: the dialog for car 42's points.
    const { fakeServer, dialog } = renderDialogFor({
      overrideKey: { sourceId: 'simulador-enduro', scope: 'car', carNumber: 42, field: 'points' },
    });

    // Act: type 512,5 and a reason, and save.
    fireEvent.change(dialog.getByLabelText('Valor corrigido'), { target: { value: '512,5' } });
    fireEvent.change(dialog.getByLabelText('Motivo (obrigatório)'), {
      target: { value: 'Penalidade revista.' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Salvar correção' }));

    // Assert: 512.5 as a number.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the points as a number').toEqual([
        {
          type: 'setOverride',
          sourceId: 'simulador-enduro',
          scope: 'car',
          carNumber: 42,
          field: 'points',
          value: 512.5,
          reason: 'Penalidade revista.',
        },
      ]);
    });
  });

  const refusedScenarios = [
    // A correction nobody explained confuses the next operator.
    {
      name: 'refuses a blank reason',
      value: 'Enduro — Etapa Nacional',
      reason: '  ',
      message: 'Escreva o motivo da correção.',
    },
    // An empty name would show nothing on air.
    {
      name: 'refuses an empty session name',
      value: '',
      reason: 'Nome oficial.',
      message: 'O valor "" não serve para Sessão › Nome da sessão.',
    },
  ];

  it.each(refusedScenarios)('$name and sends nothing', ({ value, reason, message }) => {
    // Arrange: the dialog for the session name.
    const { fakeServer, dialog } = renderDialogFor({
      overrideKey: { sourceId: 'simulador-enduro', scope: 'session', field: 'sessionName' },
    });

    // Act: type this row's value and reason, and save.
    fireEvent.change(dialog.getByLabelText('Valor corrigido'), { target: { value } });
    fireEvent.change(dialog.getByLabelText('Motivo (obrigatório)'), { target: { value: reason } });
    fireEvent.click(dialog.getByRole('button', { name: 'Salvar correção' }));

    // Assert: the message in the dialog, and no command.
    expect(dialog.getByText(message), 'the problem must be said').toBeVisible();
    expect(fakeServer.listCommandsReceived(), 'nothing may be sent').toEqual([]);
  });

  it('sends clearOverride with "Remover correção"', async () => {
    // Arrange: the dialog for the session name while it is corrected.
    const { fakeServer, dialog } = renderDialogFor({
      overrideKey: { sourceId: 'simulador-enduro', scope: 'session', field: 'sessionName' },
      overrideInForce: {
        sourceId: 'simulador-enduro',
        scope: 'session',
        field: 'sessionName',
        value: 'Enduro — Etapa Nacional',
        reason: 'Nome oficial da prova.',
        setBy: 'operador:3f2a9c1e',
        setAt: '2027-03-20T19:25:00.000Z',
      },
    });

    // Act: remove the correction.
    fireEvent.click(dialog.getByRole('button', { name: 'Remover correção' }));

    // Assert: the clear of that key.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the correction must be removed').toEqual([
        {
          type: 'clearOverride',
          sourceId: 'simulador-enduro',
          scope: 'session',
          field: 'sessionName',
        },
      ]);
    });
  });
});
