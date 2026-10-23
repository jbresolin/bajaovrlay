import { findUsesOfMedia, type Media, type PlacesThatUseMedia } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

const bytesPerMegabyte = 1024 * 1024;
const megabytesInPortuguese = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * The ids of the images nothing uses: no team, person or sponsor names it, no item holds
 * its address, no instance on air or in preview shows it (the server's own check before
 * deleteMedia, findUsesOfMedia). What "Limpar imagens sem uso" deletes. An image
 * "Remover" took off a record stays in the store until then, so a removal by mistake is
 * undone with "Trocar" and the same file.
 */
export function listUnusedMediaIds(media: Media, places: PlacesThatUseMedia): string[] {
  return media
    .filter((mediaRecord) => findUsesOfMedia(places, mediaRecord.mediaId).length === 0)
    .map((mediaRecord) => mediaRecord.mediaId);
}

/**
 * The size of the media folder in pt-BR megabytes, "3,4 MB": the sum of the images the
 * media slice lists, which the server keeps equal to the folder (it removes a deleted
 * image's file at once). It is the data-folder growth the USB backup will copy.
 */
export function writeMediaFolderSize(media: Media): string {
  const totalBytes = media.reduce((sum, mediaRecord) => sum + mediaRecord.sizeBytes, 0);
  return ptBR.entityLibrary.media.sizeInMegabytes(
    megabytesInPortuguese.format(totalBytes / bytesPerMegabyte),
  );
}
