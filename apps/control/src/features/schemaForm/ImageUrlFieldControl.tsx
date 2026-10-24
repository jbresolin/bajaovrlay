import { buildMediaUrl, readMediaIdOfMediaUrl } from '@bajaovrlay/shared';

import { EntityImageField } from '@/features/entityLibrary/EntityImageField';

import type { SchemaFormFieldValue } from './schemaFormValues';

/** What a field row gives the picker. */
export type ImageUrlFieldControlProps = {
  controlId: string;
  label: string;
  formValue: SchemaFormFieldValue;
  onFormValueChange: (formValue: SchemaFormFieldValue) => void;
};

/**
 * The control of an image field typed by hand (a string the manifest marks
 * `v_baja.role: imageUrl`, packages/graphics/README.md): the Cadastros page's image field,
 * so a file chosen or dropped is uploaded to the media store at once, and the field holds
 * its address, "/media/<mediaId>", which the graphic draws with <img>. "Remover" clears
 * the field. A stored value that is not an address of the media store shows no thumbnail.
 */
export function ImageUrlFieldControl(props: ImageUrlFieldControlProps) {
  const storedUrl = typeof props.formValue === 'string' ? props.formValue : '';
  const mediaId = readMediaIdOfMediaUrl(storedUrl) ?? '';
  return (
    <EntityImageField
      controlId={props.controlId}
      label={props.label}
      mediaId={mediaId}
      onMediaIdChange={(newMediaId) => {
        props.onFormValueChange(newMediaId === '' ? null : buildMediaUrl(newMediaId));
      }}
    />
  );
}
