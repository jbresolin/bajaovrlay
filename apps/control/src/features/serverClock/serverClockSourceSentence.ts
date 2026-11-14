import type { ServerClockLastAnswer, ServerClockSource } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';
import { formatTimeOfDay } from '@/i18n/timeOfDayText';

const texts = ptBR.serverClock;

/** A source as the operator reads it: "NTP (a.st1.ntp.br)", "HTTPS (www.cloudflare.com)". */
function nameTheSourceOfAnAnswer(answer: ServerClockLastAnswer): string {
  return answer.source === 'ntp'
    ? texts.followingNtp(answer.serverName)
    : texts.followingHttps(answer.serverName);
}

/**
 * The pt-BR sentence saying what the server clock follows (BAJAOVRLAY-76), for the top of
 * the header's menu and for "Verificar servidor": the source and its last answer's time
 * (this computer's zone, as every time on the page) and difference; following nothing,
 * "sem sincronização — hora do computador", with the last answer of either source if any.
 */
export function describeTheServerClockSource(source: ServerClockSource): string {
  if (source.following !== 'none') {
    const { lastAnswer } = source;
    return texts.sourceWithItsLastAnswer(
      nameTheSourceOfAnAnswer(lastAnswer),
      formatTimeOfDay(lastAnswer.atMs),
      lastAnswer.differenceMs,
    );
  }
  if (source.lastAnswer === null) {
    return texts.nothingFollowedNoAnswerEver;
  }
  return texts.nothingFollowedSinceAnAnswer(
    formatTimeOfDay(source.lastAnswer.atMs),
    nameTheSourceOfAnAnswer(source.lastAnswer),
    source.lastAnswer.differenceMs,
  );
}
