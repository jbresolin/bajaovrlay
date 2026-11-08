import {
  addUpExpectedBackupSize,
  chooseTheLatestBackup,
  type EventLogEntry,
  formatBackupSize,
} from '@bajaovrlay/shared';
import { cn } from 'cn';
import { useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import {
  type BackupSummaryOutcome,
  buildBackupDownloadAddress,
  fetchBackupSummary,
} from './fetchBackupSummary';
import { describeLatestBackup } from './latestBackupText';

const texts = ptBR.backup;

/**
 * The header's "Cópia de segurança" button and the dialog it opens (BAJAOVRLAY-33): the
 * "Incluir gravações" tick, the expected size, "Baixar", and "Última cópia". The sizes and
 * the newest backup are asked of the server each time the dialog opens; a backup made
 * since arrives in the live event log and takes over "Última cópia" at once.
 *
 * "Baixar" is a link, not a fetch: the browser saves the zip straight to the file the
 * operator picks (the USB stick), and a backup of gigabytes never passes through the
 * page's memory. The cost: the page cannot tell when the download ends; the event-log row
 * the server writes then is what moves "Última cópia".
 */
export function BackupDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [summaryOutcome, setSummaryOutcome] = useState<BackupSummaryOutcome | undefined>();
  const [isIncludingRecordings, setIsIncludingRecordings] = useState(true);
  const [isDownloadStarted, setIsDownloadStarted] = useState(false);
  // Read when the dialog opens, not while drawing: "today" in "Última cópia" is the day
  // the dialog was opened, which is the same day for as long as a break lasts.
  const [openedAtMs, setOpenedAtMs] = useState(0);
  const liveEventLog = useServerState((state) => state.eventLog);

  /** Opens the dialog afresh and asks the server for the sizes and the newest backup. */
  function openTheDialog(): void {
    setSummaryOutcome(undefined);
    setIsDownloadStarted(false);
    setOpenedAtMs(Date.now());
    setIsOpen(true);
    void fetchBackupSummary().then(setSummaryOutcome);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openTheDialog}>
        {texts.openButton}
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent closeButtonLabel={texts.closeDialogButton} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{texts.dialogTitle}</DialogTitle>
            <DialogDescription>{texts.dialogDescription}</DialogDescription>
          </DialogHeader>
          <BackupDialogBody
            summaryOutcome={summaryOutcome}
            liveEventLog={liveEventLog}
            openedAtMs={openedAtMs}
            isIncludingRecordings={isIncludingRecordings}
            onIncludingRecordingsChange={setIsIncludingRecordings}
            isDownloadStarted={isDownloadStarted}
            onDownloadStarted={() => setIsDownloadStarted(true)}
          />
        </DialogContent>
      </Dialog>
    </>
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
