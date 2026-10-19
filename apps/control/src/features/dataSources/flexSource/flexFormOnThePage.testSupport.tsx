// Test support: the "Fontes de dados" page with the flex HTTP/JSON form open, and the few
// things an operator does in that form, so each flex form test reads as the steps an
// operator takes. Every call works on the page the test drew; nothing is shared.
import type { DataSource } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';

import { pressButton, typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSimulatorThatIsOk,
  buildSlicesWithDataSources,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { DataSourcesPage } from '../DataSourcesPage';
import { readExampleTimingSystemConfigText } from './timingSystemExample.testSupport';

/** The name of the new flex source form's region. */
export const newFlexFormName = 'Nova fonte: HTTP/JSON (flexível)';

/** Draws the page with these sources (the simulator alone by default). */
export function renderPageWithSources(dataSources: DataSource[] = [buildSimulatorThatIsOk()]) {
  return renderOnControlPageConnectedToFakeServer(
    <DataSourcesPage />,
    buildSlicesWithDataSources({ dataSources, recordings: [] }),
  );
}

/** Presses "+ Fonte" and picks "HTTP/JSON (flexível)", which opens the empty flex form. */
export function openTheNewFlexForm() {
  pressButton('+ Fonte');
  const kindChoice = within(screen.getByRole('group', { name: 'Que tipo de fonte?' }));
  fireEvent.click(kindChoice.getByRole('button', { name: 'HTTP/JSON (flexível)' }));
  return within(screen.getByRole('region', { name: newFlexFormName }));
}

/** Pastes a config into "Importar configuração" and presses "Importar". */
export function importConfigText(configText: string): void {
  pressButton('Importar configuração');
  typeIntoField('Configuração para importar (JSON)', configText);
  pressButton('Importar');
}

/** Imports the example preset, as João's walk does first. */
export function importTheExamplePreset(): void {
  importConfigText(readExampleTimingSystemConfigText());
}

/** Opens a dropdown found by its name and picks an option, both inside one part of the page. */
export function chooseOptionIn(
  part: ReturnType<typeof within>,
  dropdownName: string,
  optionName: string,
): void {
  fireEvent.keyDown(part.getByRole('combobox', { name: dropdownName }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}
