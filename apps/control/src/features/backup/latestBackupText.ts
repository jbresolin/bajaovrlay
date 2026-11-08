import { type BackupMade, formatBackupSize } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';
import { formatDateAndTimeOfDay } from '@/i18n/timeOfDayText';

const texts = ptBR.backup;

/**
 * "Última cópia: 14:32, 48 MB" on the operator's clock; a copy made on another day reads
 * with its date ("13/11/2026, 10:30"), so yesterday's copy is never taken for today's.
 */
export function describeLatestBackup(latestBackup: BackupMade, nowMs: number): string {
  const madeAt = new Date(latestBackup.madeAt);
  const isMadeToday = madeAt.toDateString() === new Date(nowMs).toDateString();
  const whenText = isMadeToday
    ? madeAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : formatDateAndTimeOfDay(madeAt.getTime());
  return texts.latestBackup(whenText, formatBackupSize(latestBackup.sizeInBytes));
}
