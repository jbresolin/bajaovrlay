/**
 * The server's pt-BR messages about the media store (uploaded logos and photos), reached
 * as ptBR.mediaErrors. Kept apart from ptBR.ts to keep that file short.
 */
export const ptBRMediaErrors = {
  /** POST /api/v1/media with no file in the "file" field. */
  fileMissing: 'Envie um arquivo de imagem no campo "file".',
  /** A file over the 5 MB limit. */
  fileTooLarge: 'A imagem passa de 5 MB; reduza-a antes de enviar.',
  /** A file whose bytes are not a PNG, JPEG, WebP or SVG, whatever its name says. */
  typeNotAccepted: (fileName: string) =>
    `O arquivo "${fileName}" não é uma imagem PNG, JPEG, WebP ou SVG.`,
  /** An image whose header is cut off, or an SVG that gives no size. */
  sizeUnreadable: (fileName: string) =>
    `Não consegui ler o tamanho da imagem "${fileName}"; um SVG precisa de width e height ou de viewBox.`,
  /** An upload when the store holds 1000 images or 500 MB already. */
  storeFull:
    'O servidor já guarda 1000 imagens ou 500 MB; exclua imagens sem uso em Cadastros antes de enviar outra.',
  /** An upload that would leave less than 1 GB free on the server's disk. */
  diskNearlyFull:
    'O disco do servidor está quase cheio (menos de 1 GB livre); libere espaço antes de enviar imagens.',
  /** An upload sent by a page of another site (its Origin is not this server). */
  uploadFromAnotherSite: 'Imagens só podem ser enviadas pela página Cadastros deste servidor.',
  /** GET /media/<mediaId> of an image the store does not hold. */
  mediaNotServed: 'Imagem não encontrada no servidor.',
  /** A record naming an image the store does not hold, field first: "Logo: …". */
  mediaNotInTheStore: (fieldLabel: string) =>
    `${fieldLabel}: a imagem não está no servidor; envie-a de novo.`,
  /** deleteMedia of an image some records still use, each named with its field. */
  mediaInUse: (fileName: string, uses: string[]) =>
    `A imagem "${fileName}" é usada por: ${uses.join('; ')}. Troque ou remova a imagem onde ela é usada antes de excluí-la.`,
  /** One use in that list: "Equipe 42 (Baja UFPR) › Logo". */
  oneUse: (recordDescription: string, fieldLabel: string) => `${recordDescription} › ${fieldLabel}`,
};
