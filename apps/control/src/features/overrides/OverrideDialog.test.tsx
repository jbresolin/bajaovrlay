/**
 * The correction dialog (apps/control)
 *
 * What this module is for:
 *   "Corrigir valor…" (Fontes) and "Corrigir valor da fonte…" (Edição rápida) open one
 *   dialog: what is corrected, the value now, the corrected value (a dropdown for a flag,
 *   a status or a kind of session, a number for the leader's laps, mm:ss for the scheduled duration,
 *   text otherwise),
 *   and the reason, required. "Salvar correção" sends setOverride; "Remover correção",
 *   shown when a correction is in force, sends clearOverride.
 *
 * What these tests prove:
 *   - A flag correction is chosen from the flags and sent as setOverride.
 *   - The leader's laps are sent as a number; a scheduled duration is typed and shown as
 *     mm:ss, as every clock field is, and sent in milliseconds.
 *   - The dialog shows only the refusal of its own command, never another correction's,
 *     and its buttons are off while it waits for the server.
 *   - A blank reason, or a value the field cannot hold, is refused in the dialog and
 *     nothing is sent.
 *   - "Remover correção" sends clearOverride for the correction in force.
 *
 * What these tests deliberately do not cover:
 *   - Where the dialog is opened from; the Edição rápida and Fontes tests.
 */
import type { Override } from '@bajaovrlay/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
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

  it("sends the leader's laps typed as a number", async () => {
    // Arrange: the dialog for the laps of the leader.
    const { fakeServer, dialog } = renderDialogFor({
      overrideKey: {
        sourceId: 'simulador-enduro',
        scope: 'session',
        field: 'lapsCompletedByLeader',
      },
    });

    // Act: type 35 and a reason, and save.
    fireEvent.change(dialog.getByLabelText('Valor corrigido'), { target: { value: '35' } });
    fireEvent.change(dialog.getByLabelText('Motivo (obrigatório)'), {
      target: { value: 'A volta 35 do líder não foi lida.' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Salvar correção' }));

    // Assert: 35 as a number, not the text "35".
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the laps as a number').toEqual([
        {
          type: 'setOverride',
          sourceId: 'simulador-enduro',
          scope: 'session',
          field: 'lapsCompletedByLeader',
          value: 35,
          reason: 'A volta 35 do líder não foi lida.',
        },
      ]);
    });
  });

  it('sends a scheduled duration typed as minutes and seconds, in milliseconds', async () => {
    // Arrange: the dialog for the session's scheduled duration.
    const { fakeServer, dialog } = renderDialogFor({
      overrideKey: { sourceId: 'simulador-enduro', scope: 'session', field: 'scheduledDurationMs' },
    });

    // Act: type four hours as the clock fields take them, 240:00, and save.
    fireEvent.change(dialog.getByLabelText('Valor corrigido'), { target: { value: '240:00' } });
    fireEvent.change(dialog.getByLabelText('Motivo (obrigatório)'), {
      target: { value: 'O enduro tem quatro horas.' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Salvar correção' }));

    // Assert: four hours in milliseconds, the unit the session holds.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the duration in milliseconds').toEqual([
        {
          type: 'setOverride',
          sourceId: 'simulador-enduro',
          scope: 'session',
          field: 'scheduledDurationMs',
          value: 14_400_000,
          reason: 'O enduro tem quatro horas.',
        },
      ]);
    });
  });

  it('fills a scheduled duration in force as minutes and seconds', () => {
    // Arrange and act: the dialog for a duration corrected to three hours.
    const { dialog } = renderDialogFor({
      overrideKey: { sourceId: 'simulador-enduro', scope: 'session', field: 'scheduledDurationMs' },
      overrideInForce: {
        sourceId: 'simulador-enduro',
        scope: 'session',
        field: 'scheduledDurationMs',
        value: 10_800_000,
        reason: 'Prova encurtada pela chuva.',
        setBy: 'operador:3f2a9c1e',
        setAt: '2027-03-20T19:25:00.000Z',
      },
    });

    // Assert: 180:00, never the raw 10800000.
    expect(
      dialog.getByLabelText('Valor corrigido'),
      'the correction must read as minutes and seconds',
    ).toHaveValue('180:00');
  });

  it("shows its own refusal and not another command's", async () => {
    // Arrange: a refusal of another correction already on the page, then the dialog.
    const { fakeServer, serverStateStore, dialog } = renderDialogFor({
      overrideKey: { sourceId: 'simulador-enduro', scope: 'session', field: 'sessionName' },
    });
    act(() =>
      serverStateStore.getState().rememberCommandError({
        commandType: 'setOverride',
        code: 'INVALID_OVERRIDE_VALUE',
        message: 'O valor "" não serve para Equipe.',
      }),
    );

    // Act: save this correction, and the server refuses it.
    fireEvent.change(dialog.getByLabelText('Valor corrigido'), {
      target: { value: 'Enduro — Etapa Nacional' },
    });
    fireEvent.change(dialog.getByLabelText('Motivo (obrigatório)'), {
      target: { value: 'Nome oficial.' },
    });
    const otherRefusalShownBeforeSaving = dialog.queryByText('O valor "" não serve para Equipe.');
    fireEvent.click(dialog.getByRole('button', { name: 'Salvar correção' }));
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the correction is sent').toHaveLength(1);
    });
    fakeServer.refuseLastCommand({
      code: 'DATA_SOURCE_NOT_FOUND',
      message: 'A fonte simulador-enduro não existe mais.',
    });

    // Assert: the other refusal was never shown; this one is, and the dialog stays open.
    expect(otherRefusalShownBeforeSaving, "another command's refusal must not show").toBeNull();
    expect(
      await dialog.findByText('A fonte simulador-enduro não existe mais.'),
      'its own refusal must show',
    ).toBeVisible();
  });

  it('turns its buttons off while it waits for the server', async () => {
    // Arrange: the dialog for the session name, filled.
    const { fakeServer, dialog } = renderDialogFor({
      overrideKey: { sourceId: 'simulador-enduro', scope: 'session', field: 'sessionName' },
    });
    fireEvent.change(dialog.getByLabelText('Valor corrigido'), {
      target: { value: 'Enduro — Etapa Nacional' },
    });
    fireEvent.change(dialog.getByLabelText('Motivo (obrigatório)'), {
      target: { value: 'Nome oficial.' },
    });

    // Act: save, and the server has not answered yet.
    fireEvent.click(dialog.getByRole('button', { name: 'Salvar correção' }));
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the correction is sent').toHaveLength(1);
    });

    // Assert: a second press cannot send it again while it waits.
    expect(
      dialog.getByRole('button', { name: 'Salvar correção' }),
      'saving must be off while the server has not answered',
    ).toBeDisabled();
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
