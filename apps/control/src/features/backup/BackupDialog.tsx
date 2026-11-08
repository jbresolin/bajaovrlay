import {
  addUpExpectedBackupSize,
  chooseTheLatestBackup,
  type EventLogEntry,
  formatBackupSize,
} from '@bajaovrlay/shared';
import { cn } from 'cn';

import { buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { type BackupSummaryOutcome, buildBackupDownloadAddress } from './fetchBackupSummary';
import { describeLatestBackup } from './latestBackupText';
import type { BackupDialogState } from './useBackupDialog';

const texts = ptBR.backup;

/**
 * The "Cópia de segurança" dialog (BAJAOVRLAY-33), opened from the header's menu
 * (BAJAOVRLAY-62) through `useBackupDialog`: the "Incluir gravações" tick, the expected
 * size, "Baixar", and "Última cópia". The sizes and the newest backup are asked of the
 * server each time the dialog opens; a backup made since arrives in the live event log
 * and takes over "Última cópia" at once.
 *
 * "Baixar" is a link, not a fetch: the browser saves the zip straight to the file the
 * operator picks (the USB stick), and a backup of gigabytes never passes through the
 * page's memory. The cost: the page cannot tell when the download ends; the event-log row
 * the server writes then is what moves "Última cópia".
 */
export function BackupDialog(props: { backupDialog: BackupDialogState }) {
  const backupDialog = props.backupDialog;
  const liveEventLog = useServerState((state) => state.eventLog);

  return (
    <Dialog open={backupDialog.isOpen} onOpenChange={backupDialog.setIsOpen}>
      <DialogContent closeButtonLabel={texts.closeDialogButton} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{texts.dialogTitle}</DialogTitle>
          <DialogDescription>{texts.dialogDescription}</DialogDescription>
        </DialogHeader>
        <BackupDialogBody
          summaryOutcome={backupDialog.summaryOutcome}
          liveEventLog={liveEventLog}
          openedAtMs={backupDialog.openedAtMs}
          isIncludingRecordings={backupDialog.isIncludingRecordings}
          onIncludingRecordingsChange={backupDialog.setIsIncludingRecordings}
          isDownloadStarted={backupDialog.isDownloadStarted}
          onDownloadStarted={backupDialog.markTheDownloadStarted}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * What the dialog shows below its title: a wait while the server answers, a pt-BR
 * sentence when it did not, and otherwise the tick, the size, "Baixar" (or why not) and
 * "Última cópia".
 */
function BackupDialogBody(props: {
  summaryOutcome: BackupSummaryOutcome | undefined;
  liveEventLog: readonly EventLogEntry[];
  openedAtMs: number;
  isIncludingRecordings: boolean;
  onIncludingRecordingsChange: (isIncludingRecordings: boolean) => void;
  isDownloadStarted: boolean;
  onDownloadStarted: () => void;
}) {
  if (props.summaryOutcome === undefined) {
    return <p className="text-sm text-muted-foreground">{texts.loadingSummary}</p>;
  }
  if (!props.summaryOutcome.isFetched) {
    return <p className="text-sm text-destructive">{texts.summaryUnavailable}</p>;
  }
  const summary = props.summaryOutcome.summary;
  const expectedSizeInBytes = addUpExpectedBackupSize(summary, props.isIncludingRecordings);
  const latestBackup = chooseTheLatestBackup(summary.latestBackup ?? undefined, props.liveEventLog);
  const latestBackupText =
    latestBackup === undefined
      ? texts.noBackupYet
      : describeLatestBackup(latestBackup, props.openedAtMs);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={props.isIncludingRecordings}
          onChange={(event) => props.onIncludingRecordingsChange(event.target.checked)}
        />
        <span>{texts.includeRecordings}</span>
      </label>
      <p className="text-sm">{texts.expectedSize(formatBackupSize(expectedSizeInBytes))}</p>
      {summary.isABackupRunning ? (
        <p className="text-sm text-destructive">{texts.backupAlreadyRunning}</p>
      ) : (
        <a
          href={buildBackupDownloadAddress(props.isIncludingRecordings)}
          download
          onClick={props.onDownloadStarted}
          className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'self-start')}
        >
          {texts.downloadButton}
        </a>
      )}
      {props.isDownloadStarted && (
        <p className="text-sm text-muted-foreground">{texts.downloadStarted}</p>
      )}
      <p className="text-sm text-muted-foreground">{latestBackupText}</p>
    </div>
  );
}
