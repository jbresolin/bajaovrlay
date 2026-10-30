/**
 * "Limpar tudo" with more than one output (apps/control)
 *
 * What this module is for:
 *   clearAll empties every output, a PiP's included (BAJAOVRLAY-49, the plainer choice,
 *   recorded in docs/decisions.md): the panic button must leave nothing on any OBS source.
 *   With a second output the operator might expect program alone to go, so the armed
 *   button says it.
 *
 * What these tests prove:
 *   - With program and PiP the armed button reads "Confirmar: limpar tudo, todas as
 *     saídas", and the second press sends the one clearAll.
 *   - With program alone it reads "Confirmar: limpar tudo", as it always did.
 *
 * What these tests deliberately do not cover:
 *   - Esc and the 3-second window; ClearAllButton.test.tsx.
 *   - What clearAll removes; the server's commandsOnAPipLayer.test.ts.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithThePipOutput } from '@/state/outputsLikeTheServerSends.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { ClearAllButton } from './ClearAllButton';

describe('"Limpar tudo" with a PiP output', () => {
  it('says the armed press clears every output, then sends one clearAll', () => {
    // Arrange: program and PiP.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <ClearAllButton />,
      buildSlicesWithThePipOutput(),
    );

    // Act: arm the button, read it, confirm.
    fireEvent.click(screen.getByRole('button', { name: 'Limpar tudo' }));
    const armedButton = screen.getByRole('button', {
      name: 'Confirmar: limpar tudo, todas as saídas',
    });
    fireEvent.click(armedButton);

    // Assert: one clearAll.
    expect(fakeServer.listCommandsReceived(), 'one clearAll for every output').toEqual([
      { type: 'clearAll' },
    ]);
  });
});

describe('"Limpar tudo" with program alone', () => {
  it('reads as it always did', () => {
    // Arrange: program alone.
    renderOnControlPageConnectedToFakeServer(<ClearAllButton />, buildSlicesWithNothingOnAir());

    // Act: arm the button.
    fireEvent.click(screen.getByRole('button', { name: 'Limpar tudo' }));

    // Assert: the usual text.
    expect(
      screen.getByRole('button', { name: 'Confirmar: limpar tudo' }),
      'no word about outputs with one output',
    ).toBeInTheDocument();
  });
});
