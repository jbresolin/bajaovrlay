/**
 * pt-BR catalog, backup part (features/backup, BAJAOVRLAY-33): the "Cópia de segurança"
 * entry of the header's menu and the dialog it opens. Kept in a file of its own so ptBR.ts stays
 * readable; ptBR.ts makes it `ptBR.backup`.
 */
export const ptBRBackup = {
  menuEntry: 'Cópia de segurança',
  dialogTitle: 'Cópia de segurança',
  dialogDescription:
    'Baixa o banco de dados, as imagens e as gravações num único arquivo .zip. Na janela de salvar do navegador, escolha o pendrive.',
  includeRecordings: 'Incluir gravações',
  // The sum of the parts on disk now: the zip is stored, not compressed, so it weighs that.
  expectedSize: (sizeText: string) => `Tamanho previsto: ${sizeText}`,
  downloadButton: 'Baixar',
  // After "Baixar": the browser saves the file; the server's row arrives when it is done.
  downloadStarted: 'O navegador está baixando a cópia. "Última cópia" muda quando ela terminar.',
  // From the event log: today "14:32, 48 MB", another day "13/11/2026, 14:32, 48 MB".
  latestBackup: (whenText: string, sizeText: string) => `Última cópia: ${whenText}, ${sizeText}`,
  noBackupYet: 'Nenhuma cópia feita ainda.',
  loadingSummary: 'Calculando o tamanho…',
  summaryUnavailable: 'Não consegui falar com o servidor para calcular o tamanho. Tente de novo.',
  // While another backup is being sent, the server would refuse a second one.
  backupAlreadyRunning:
    'Já há uma cópia de segurança sendo baixada. Espere ela terminar e abra esta janela de novo.',
  closeDialogButton: 'Fechar',
};
