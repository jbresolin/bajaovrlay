import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ptBR } from '@/i18n/ptBR';

import { uploadImageFile } from './imageUpload';
import { MediaThumbnail } from './MediaThumbnail';

const texts = ptBR.entityLibrary.image;

// The four kinds the media store takes, for the file picker's filter. The server checks
// the bytes anyway; this only spares the operator a refusal.
const acceptedImageTypes = 'image/png,image/jpeg,image/webp,image/svg+xml';

/** What the form gives one image field. */
export type EntityImageFieldProps = {
  /** The id of the file input, which the field's label names. */
  controlId: string;
  /** The field's label, for the thumbnail's description ("Logo atual"). */
  label: string;
  /** The media id the record holds now, or "" for none. */
  mediaId: string;
  /** Called with the new media id after an upload, or "" after "Remover". */
  onMediaIdChange: (mediaId: string) => void;
};

/**
 * One image field of a Cadastros form (a logo, a car photo, a photo): a file chosen with
 * "Escolher imagem" or dropped on the field is sent to the media store at once, and the
 * form keeps the media id the server answers and shows the thumbnail. "Trocar" picks
 * another file, "Remover" takes the image off the record; the file stays in the store
 * until "Limpar imagens sem uso", so a removal by mistake costs nothing. A refusal (not
 * an image, over 5 MB) is shown in the server's words. The record itself is saved with
 * the form's "Salvar", like any field.
 */
export function EntityImageField(props: EntityImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  async function uploadTheFile(file: File | undefined): Promise<void> {
    if (file === undefined) {
      return;
    }
    setIsUploading(true);
    setRefusal(null);
    const outcome = await uploadImageFile(file);
    setIsUploading(false);
    if (outcome.isUploaded) {
      props.onMediaIdChange(outcome.answer.mediaId);
    } else {
      setRefusal(outcome.reason);
    }
  }

  const hasAnImage = props.mediaId !== '';
  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-dashed p-3"
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        void uploadTheFile(event.dataTransfer.files[0]);
      }}
    >
      <input
        ref={fileInputRef}
        id={props.controlId}
        type="file"
        accept={acceptedImageTypes}
        className="sr-only"
        onChange={(event) => {
          void uploadTheFile(event.target.files?.[0]);
          // Cleared, so choosing the same file again uploads it again.
          event.target.value = '';
        }}
      />
      {hasAnImage && (
        <MediaThumbnail
          mediaId={props.mediaId}
          alt={texts.thumbnailAlt(props.label)}
          sizeClassName="h-24 w-24"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {hasAnImage ? texts.replaceButton : texts.chooseButton}
        </Button>
        {hasAnImage && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isUploading}
            onClick={() => props.onMediaIdChange('')}
          >
            {texts.removeButton}
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          {isUploading ? texts.uploading : texts.dropHint}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{texts.acceptedFiles}</p>
      {refusal !== null && (
        <p role="alert" className="text-sm text-destructive">
          {refusal}
        </p>
      )}
    </div>
  );
}
