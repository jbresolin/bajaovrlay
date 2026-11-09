import { useState } from 'react';

import { ptBR } from '@/i18n/ptBR';

import { postServerClockSetNow, type ServerClockSetOutcome } from './postServerClockSetNow';

const texts = ptBR.serverClock;

/** Where "Acertar relógio agora" is: asking to confirm, asking the server, or answered. */
type ServerClockSettingStep =
  | { kind: 'confirming' }
  | { kind: 'setting' }
  | { kind: 'answered'; outcome: ServerClockSetOutcome };

/** The state of "Acertar relógio agora" and its confirm, for the menu and the dialog. */
export type ServerClockSetting = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  /** The menu's entry: opens the confirm. */
  openTheConfirm: () => void;
  /** "Acertar agora": asks the server to step its clock. */
  setTheClockNow: () => Promise<void>;
  /** True until the producer confirmed: the dialog shows the question and its buttons. */
  isConfirming: boolean;
  /** Empty while confirming; then "Perguntando…", the step, or why not. */
  statusText: string;
};

/**
 * "Acertar relógio agora" (BAJAOVRLAY-62): a one-off answer to a press, not server state,
 * so it lives in the component and not in the store. Each opening starts at the confirm.
 */
export function useServerClockSetting(): ServerClockSetting {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ServerClockSettingStep>({ kind: 'confirming' });

  function openTheConfirm(): void {
    setStep({ kind: 'confirming' });
    setIsOpen(true);
  }

  async function setTheClockNow(): Promise<void> {
    setStep({ kind: 'setting' });
    const outcome = await postServerClockSetNow();
    setStep({ kind: 'answered', outcome });
  }

  return {
    isOpen,
    setIsOpen,
    openTheConfirm,
    setTheClockNow,
    isConfirming: step.kind === 'confirming',
    statusText: describeTheSettingStep(step),
  };
}

/** The pt-BR sentence the dialog shows once the producer confirmed. */
function describeTheSettingStep(step: ServerClockSettingStep): string {
  if (step.kind === 'confirming') {
    return '';
  }
  if (step.kind === 'setting') {
    return texts.setting;
  }
  switch (step.outcome.kind) {
    case 'set':
      return texts.setBy(step.outcome.steppedByMs);
    case 'refused':
      return step.outcome.message;
    case 'unreachable':
      return texts.unreachable;
  }
}
