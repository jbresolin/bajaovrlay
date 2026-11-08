/** "1 arquivo", "12 arquivos". */
function countFiles(fileCount: number): string {
  return fileCount === 1 ? '1 arquivo' : `${String(fileCount)} arquivos`;
}

/**
 * The server's pt-BR texts about the backup download (BAJAOVRLAY-33), reached as
 * ptBR.backup: the refusal of a second backup, and the leia-me.txt every zip carries.
 * Kept apart from ptBR.ts to keep that file short.
 */
export const ptBRBackup = {
  /** GET /api/v1/backup while another backup is still being sent. */
  alreadyRunning:
    'Já há uma cópia de segurança sendo baixada. Espere ela terminar e tente de novo.',
  /** GET /api/v1/backup with an includeRecordings that is not "true" or "false". */
  invalidQuery: 'Use includeRecordings=true ou includeRecordings=false.',
  /** The lines of leia-me.txt; the moment is São Paulo's, written by the caller. */
  readMe: {
    title: 'Cópia de segurança do BajaOvrLay',
    madeAt: (momentText: string) => `Feita em: ${momentText} (horário de Brasília)`,
    version: (version: string) => `Versão do BajaOvrLay: ${version}`,
    contentsHeading: 'O que há nesta cópia:',
    database: '- bajaovrlay.sqlite: o banco de dados (itens, rundown, cadastros, histórico).',
    media: (fileCount: number) => `- media/: as imagens enviadas (${countFiles(fileCount)}).`,
    recordings: (fileCount: number) =>
      `- recordings/: as gravações das fontes de dados (${countFiles(fileCount)}).`,
    recordingsLeftOut: '- Sem gravações: "Incluir gravações" estava desmarcado.',
    restoreHeading: 'Para restaurar:',
    restore:
      'Siga "Restaurar uma cópia" em deploy/stream-pc/README.md: pare o servidor, descompacte ' +
      'esta cópia na pasta de dados, apague bajaovrlay.sqlite-journal se houver, e inicie o ' +
      'servidor.',
  },
};
