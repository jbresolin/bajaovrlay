// Test support (chaos suite): an NTP server the chaos server asks for real time, built on
// the server's own fake (apps/server/src/core/time/openFakeNtpServer.testSupport.ts, a real
// UDP socket). It answers this machine's time moved by an offset the scenario sets, so the
// server sees real time "jump" without anyone touching this machine's clock; or it answers
// nothing at all, as an unreachable NTP server does. Nothing is shared between scenarios.
import {
  buildAnswerOfAHealthyServer,
  openFakeNtpServer,
} from '../../../../server/src/core/time/openFakeNtpServer.testSupport';

/** A started fake NTP server: what to set on the server, its switches, how to close it. */
export type FakeNtpForTheServer = {
  /** The value of BAJAOVRLAY_NTP_SERVERS that points the server at it. */
  ntpServersSetting: string;
  /** From the next question on, real time is this machine's time plus `offsetMs`. */
  answerTimeMovedBy: (offsetMs: number) => void;
  /** From the next question on, nothing answers, as an NTP server out of reach. */
  stopAnswering: () => void;
  close: () => void;
};

/** Opens a fake NTP server answering this machine's own time (offset 0) until told otherwise. */
export async function openFakeNtpForTheServer(): Promise<FakeNtpForTheServer> {
  let offsetMs = 0;
  let isAnswering = true;
  const fakeNtpServer = await openFakeNtpServer((question) => {
    if (!isAnswering) {
      return undefined;
    }
    const realTimeMs = Date.now() + offsetMs;
    return buildAnswerOfAHealthyServer(question, {
      receivedAtMs: realTimeMs,
      sentAtMs: realTimeMs,
    });
  });
  return {
    ntpServersSetting: `127.0.0.1:${String(fakeNtpServer.address.port)}`,
    answerTimeMovedBy: (nextOffsetMs) => {
      offsetMs = nextOffsetMs;
    },
    stopAnswering: () => {
      isAnswering = false;
    },
    close: fakeNtpServer.closeForGood,
  };
}
