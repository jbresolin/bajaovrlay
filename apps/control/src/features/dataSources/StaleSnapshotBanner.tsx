import { ptBR } from '@/i18n/ptBR';
import { formatTimeOfDay } from '@/i18n/timeOfDayText';

/** Why the data shown is not live: the source is late, or it is turned off. */
export type WhyTheDataIsOld = 'sourceIsLate' | 'sourceIsOff';

/**
 * The amber line above data that is not live: "Dados de 15:44:00 — fonte atrasada" for a
 * late source, "… — fonte desligada" for one turned off, with the moment of the poll
 * that produced the data shown. The data itself stays on the page in full (rule 4: a
 * failure never blanks anything); this line says it is old.
 */
export function StaleSnapshotBanner(props: { receivedAtMs: number; reason: WhyTheDataIsOld }) {
  const texts = ptBR.dataSources.detail;
  const timeOfTheData = formatTimeOfDay(props.receivedAtMs);
  const bannerText =
    props.reason === 'sourceIsOff'
      ? texts.offBanner(timeOfTheData)
      : texts.staleBanner(timeOfTheData);
  return (
    <p className="rounded-md border border-warning bg-warning/15 px-3 py-2 text-sm font-medium">
      {bannerText}
    </p>
  );
}
