// Test support: finding the item editor's own fields ("Gráfico", "Camada", "Rótulo", "Cor",
// "Observações", "Onde") and never a graphic's field of the same name. The graphic's fields
// sit in the fieldset "Campos do gráfico" (SchemaFormFields.tsx); a manifest may title one
// "Rótulo" or "Cor", and a plain getByLabel inside the editor would then find two controls
// and fail. Functions only; nothing here remembers anything between calls or between tests.
import type { Locator } from '@playwright/test';

/**
 * Every element of the page that is not inside the graphic's fields. Intersected with a
 * lookup (`.and`), it keeps only the editor's own control. The fieldset is found by its
 * test id rather than its name, because a CSS selector cannot match an accessible name.
 */
function findEverythingOutsideTheGraphicFields(itemEditor: Locator): Locator {
  return itemEditor.page().locator(':not([data-testid="generated-fields"] *)');
}

/** Finds one of the item editor's own text fields by its exact label ("Rótulo", "Observações"). */
export function findItemEditorOwnTextField(itemEditor: Locator, label: string): Locator {
  return itemEditor
    .getByLabel(label, { exact: true })
    .and(findEverythingOutsideTheGraphicFields(itemEditor));
}

/** Finds one of the item editor's own dropdowns by its exact name ("Gráfico", "Camada", "Cor"). */
export function findItemEditorOwnDropdown(itemEditor: Locator, name: string): Locator {
  return itemEditor
    .getByRole('combobox', { name, exact: true })
    .and(findEverythingOutsideTheGraphicFields(itemEditor));
}
