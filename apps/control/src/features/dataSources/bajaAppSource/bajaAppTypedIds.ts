import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.dataSources.bajaApp;

// The API's own patterns (`docs/results-api.md` in the Baja app repo, "Parameters"). Ids
// are written exactly as stored, case included: "26br" is a 404 there, not 26BR. The
// capitals are ours: every event the API has is written so, and the operator is told
// rather than having the case changed for them, so what is typed is what is read.
const eventIdPattern = /^[A-Z0-9]{4}$/;
const resultadoIdEndingPattern = /^[A-Z0-9]{1,3}$/;

/**
 * What is wrong with the API address typed ("Endereço da API"), or undefined when it is
 * an http(s) address. Checked before anything is read, by the picker and the team import.
 */
export function findProblemOfTypedApiAddress(typedAddress: string): string | undefined {
  const isAnHttpAddress = /^https?:\/\//.test(typedAddress.trim());
  return isAnHttpAddress ? undefined : texts.apiAddressNotHttp;
}

/** What is wrong with the event id typed ("26BR"), or undefined when the API could have it. */
export function findProblemOfTypedEventId(typedEventId: string): string | undefined {
  const eventId = typedEventId.trim();
  if (eventId === '') {
    return texts.noEventId;
  }
  return eventIdPattern.test(eventId) ? undefined : texts.eventIdNotAsTheApiWritesIt;
}

/**
 * What is wrong with a result's id typed for one event ("26BR_SPR"), or undefined when it
 * is that event's id, "_" and 1 to 3 capital letters or digits.
 */
export function findProblemOfTypedResultadoId(
  typedResultadoId: string,
  eventId: string,
): string | undefined {
  const resultadoId = typedResultadoId.trim();
  if (resultadoId === '') {
    return texts.noResultadoId;
  }
  const prefixOfTheEvent = `${eventId}_`;
  const ending = resultadoId.slice(prefixOfTheEvent.length);
  const isOfTheEvent = resultadoId.startsWith(prefixOfTheEvent);
  const isAnId = isOfTheEvent && resultadoIdEndingPattern.test(ending);
  return isAnId ? undefined : texts.resultadoIdNotOfTheEvent(eventId);
}
