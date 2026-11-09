import type { NtpPollOutcome } from './ntpPolls.js';

/** How long the boot waits for NTP before it starts on the machine's wall clock. */
export const bootWaitForNtpMs = 3_000;

/**
 * The boot's poll of NTP, given up after 3 s: its outcome, or undefined when none came in
 * time. The poll is aborted once the 3 s have passed (an answer after them is not used, so
 * its question need not stay open) or at once when `stopSignal` is aborted (stop()).
 */
export async function pollForRealTimeWithinTheBootWait(
  poll: (abortSignal: AbortSignal) => Promise<NtpPollOutcome>,
  stopSignal: AbortSignal,
): Promise<NtpPollOutcome | undefined> {
  let waitTimer: ReturnType<typeof setTimeout> | undefined;
  const noAnswerInTime = new Promise<undefined>((resolve) => {
    waitTimer = setTimeout(() => resolve(undefined), bootWaitForNtpMs);
  });
  const bootWaitController = new AbortController();
  const bootPollAbortSignal = AbortSignal.any([stopSignal, bootWaitController.signal]);
  const outcome = await Promise.race([poll(bootPollAbortSignal), noAnswerInTime]);
  clearTimeout(waitTimer);
  bootWaitController.abort();
  return outcome;
}
