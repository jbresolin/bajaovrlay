import { useState } from 'react';

import { type BackupSummaryOutcome, fetchBackupSummary } from './fetchBackupSummary';

/** What BackupDialog draws, and how the header's menu opens it. */
export type BackupDialogState = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  /** Opens the dialog afresh and asks the server for the sizes and the newest backup. */
  openTheDialog: () => void;
  /** Undefined while the server has not answered since the dialog opened. */
  summaryOutcome: BackupSummaryOutcome | undefined;
  isIncludingRecordings: boolean;
  setIsIncludingRecordings: (isIncludingRecordings: boolean) => void;
  isDownloadStarted: boolean;
  markTheDownloadStarted: () => void;
  /** When the dialog opened, on this page's clock: the "today" of "Última cópia". */
  openedAtMs: number;
};

/**
 * The state of "Cópia de segurança": kept apart from the dialog so the header's menu
 * (features/headerMenu, BAJAOVRLAY-62) can open it, as its own button did before.
 */
export function useBackupDialog(): BackupDialogState {
  const [isOpen, setIsOpen] = useState(false);
  const [summaryOutcome, setSummaryOutcome] = useState<BackupSummaryOutcome | undefined>();
  const [isIncludingRecordings, setIsIncludingRecordings] = useState(true);
  const [isDownloadStarted, setIsDownloadStarted] = useState(false);
  // Read when the dialog opens, not while drawing: "today" in "Última cópia" is the day
  // the dialog was opened, which is the same day for as long as a break lasts. The
  // page's own clock is right here: a person reads it, and nothing on air counts from it.
  const [openedAtMs, setOpenedAtMs] = useState(0);

  function openTheDialog(): void {
    setSummaryOutcome(undefined);
    setIsDownloadStarted(false);
    setOpenedAtMs(Date.now());
    setIsOpen(true);
    void fetchBackupSummary().then(setSummaryOutcome);
  }

  return {
    isOpen,
    setIsOpen,
    openTheDialog,
    summaryOutcome,
    isIncludingRecordings,
    setIsIncludingRecordings,
    isDownloadStarted,
    markTheDownloadStarted: () => setIsDownloadStarted(true),
    openedAtMs,
  };
}
