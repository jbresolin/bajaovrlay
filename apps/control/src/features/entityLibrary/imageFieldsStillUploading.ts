/**
 * The keys of a form's image fields whose upload is still running, after one field told
 * that its upload started (`isUploading` true) or ended, stored or failed (false). A form
 * keeps its save buttons off while the list is not empty, since it does not hold the new
 * images yet (BAJAOVRLAY-51). Used by the Cadastros form and by the item editor.
 */
export function updateImageFieldsStillUploading(
  keysStillUploading: string[],
  fieldKey: string,
  isUploading: boolean,
): string[] {
  const otherKeysStillUploading = keysStillUploading.filter((key) => key !== fieldKey);
  if (isUploading) {
    return [...otherKeysStillUploading, fieldKey];
  }
  return otherKeysStillUploading;
}
