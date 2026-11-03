// Test support: "Adicionar fonte do app Baja" driven on the Fontes page as an operator
// would, for DataSourcesPageBajaApp.test.tsx and DataSourcesPageBajaAppTypedIds.test.tsx.
// Functions only; nothing is shared between tests.
import { fireEvent, screen, within } from '@testing-library/react';

import { pressButton, typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

/** The name of the Baja app picker's region. */
export const pickerName = 'Nova fonte do app Baja';

/** 26BR's event name, as the API gives it. */
export const eventNameOf26BR = '31ª Competição Baja SAE BRASIL';

/** Presses "+ Fonte" and "Adicionar fonte do app Baja", which opens the picker. */
export function openTheBajaAppPicker() {
  pressButton('+ Fonte');
  const kindChoice = within(screen.getByRole('group', { name: 'Que tipo de fonte?' }));
  fireEvent.click(kindChoice.getByRole('button', { name: 'Adicionar fonte do app Baja' }));
  return within(screen.getByRole('region', { name: pickerName }));
}

/** Types an event id into the picker and presses "Ler evento"; waits for its name. */
export async function readTheEvent(eventId: string, expectedEventName: string) {
  typeIntoField('Código do evento', eventId);
  pressButton('Ler evento');
  await screen.findByText(expectedEventName);
}

/** The radio buttons of one list of the picker, by their names. */
export function listChoicesOf(listName: string): string[] {
  const list = within(screen.getByRole('group', { name: listName }));
  return list.queryAllByRole('radio').map((radio) => radio.getAttribute('aria-label') ?? '');
}

/** Picks one entry of a list by its name. */
export function pickChoice(listName: string, choiceName: string): void {
  const list = within(screen.getByRole('group', { name: listName }));
  fireEvent.click(list.getByRole('radio', { name: choiceName }));
}
