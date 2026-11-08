import { ptBR } from '../../core/messages/ptBR.js';
import { timeZoneOfTheEvent } from './backupFileName.js';

const readMeTexts = ptBR.backup.readMe;

// "14/11/2026 14:32", the way the operator writes a date and a time.
const momentAsTheOperatorWritesIt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: timeZoneOfTheEvent,
  dateStyle: 'short',
  timeStyle: 'short',
});

/** What leia-me.txt says about one backup. */
export type BackupReadMeFacts = {
  madeAt: Date;
  version: string;
  mediaFileCount: number;
  /** Undefined when "Incluir gravações" was unticked. */
  recordingFileCount: number | undefined;
};

/**
 * The text of leia-me.txt: when the copy was made (São Paulo's time), the BajaOvrLay
 * version, what the zip holds, and where the restore steps are. Windows line endings, so
 * Notepad on the stream PC shows the lines apart.
 */
export function writeBackupReadMe(facts: BackupReadMeFacts): string {
  const contentLines = [readMeTexts.database, readMeTexts.media(facts.mediaFileCount)];
  if (facts.recordingFileCount === undefined) {
    contentLines.push(readMeTexts.recordingsLeftOut);
  } else {
    contentLines.push(readMeTexts.recordings(facts.recordingFileCount));
  }
  const lines = [
    readMeTexts.title,
    '',
    readMeTexts.madeAt(momentAsTheOperatorWritesIt.format(facts.madeAt)),
    readMeTexts.version(facts.version),
    '',
    readMeTexts.contentsHeading,
    ...contentLines,
    '',
    readMeTexts.restoreHeading,
    readMeTexts.restore,
    '',
  ];
  return lines.join('\r\n');
}
