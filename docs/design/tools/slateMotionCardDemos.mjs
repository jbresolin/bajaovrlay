// The motion demos of the catalogue's cards (BAJAOVRLAY-43): team card, battle card, the
// notice slot (fastest lap, penalty), countdown, message ticker and QR card, one entry per
// combination of each graphic's optional parts. slateMotionDemos.mjs lists them with the
// boards' in the catalogue's order; the browser side is motionDemoCards.js.
import { renderCountdownBoard } from './slateBoards.mjs';
import {
  renderBattleCard,
  renderCountdownCard,
  renderMessageTicker,
  renderQrCard,
  renderTeamCard,
  renderTrendCell,
  writeTrendWords,
} from './slateCards.mjs';
import {
  describeParts,
  everyCombination,
  renderTemplate,
  slugOf,
} from './slateMotionDemoParts.mjs';
import { renderFastestLap, renderPenaltyNotice } from './slateNotices.mjs';
import { sample } from './slateTemplates.mjs';

// Team card: photo, logo and city are each optional (the entity library may lack any).
export function listTeamCardDemos() {
  const team = sample.teamCards.withMedia;
  const partNames = ['foto', 'logo', 'cidade'];
  return everyCombination(3).map(([withPhoto, withLogo, withCity]) => {
    const words = describeParts(partNames, [withPhoto, withLogo, withCity]);
    const shownTeam = {
      ...team,
      photoPath: withPhoto ? team.photoPath : undefined,
      logoInitials: withLogo ? team.logoInitials : undefined,
      city: withCity ? team.city : undefined,
    };
    return {
      fileName: `motion-team-card-${slugOf(words)}.html`,
      group: 'Cartão de equipe',
      variant: words.join(', '),
      demoName: 'team-card',
      family: 'Cards',
      actions: ['enter', 'exit'],
      stage: renderTeamCard(shownTeam),
    };
  });
}

export function listBattleCardDemos() {
  const updates = sample.battle.updates.map((reading) => ({
    gapText: reading.gapText,
    trend: reading.trend,
    trendWords: writeTrendWords(reading.trend, reading.changeText),
  }));
  const firstReading = sample.battle.updates[0];
  const trendTemplates = ['closing', 'opening', 'steady'].map((trend) =>
    renderTemplate(`trend-${trend}`, renderTrendCell(trend, writeTrendWords(trend, ''))),
  );
  return [
    {
      fileName: 'motion-battle-card.html',
      group: 'Disputa',
      variant: 'diferença e tendência a cada volta',
      demoName: 'battle-card',
      family: 'Cards',
      actions: ['enter', 'exit', 'update'],
      stage: renderBattleCard(
        { ...sample.battle, gapText: firstReading.gapText },
        firstReading.trend,
      ),
      templates: trendTemplates,
      config: { updates },
    },
  ];
}

// The notice slot: the page's own notice first, then the others Novo evento brings in turn.
const noticeEvents = [
  { id: 'event-fastest-lap', kind: 'fastest-lap', html: renderFastestLap(sample.fastestLap) },
  { id: 'event-penalty', kind: 'penalty', html: renderPenaltyNotice(sample.notices.penalty) },
  { id: 'event-incident', kind: 'incident', html: renderPenaltyNotice(sample.notices.incident) },
  { id: 'event-black-flag', kind: 'penalty', html: renderPenaltyNotice(sample.notices.blackFlag) },
];

function buildNoticeDemo({ fileName, group, variant, ownHtml, ownKind }) {
  const others = noticeEvents.filter((event) => event.kind !== ownKind);
  return {
    fileName,
    group,
    variant,
    demoName: 'notices',
    family: 'Cards',
    actions: ['enter', 'exit', 'newEvent'],
    stage: ownHtml,
    templates: [
      renderTemplate('event-own', ownHtml),
      ...others.map((event) => renderTemplate(event.id, event.html)),
    ],
    config: { eventTemplates: ['event-own', ...others.map((event) => event.id)] },
  };
}

// Fastest lap: the lap it was set on is optional. Penalty: the sanction is optional.
export function listNoticeDemos() {
  const fastestLapWithoutLap = { ...sample.fastestLap, lap: undefined };
  const penaltyWithoutSanction = { ...sample.notices.penalty, penalty: '' };
  return [
    buildNoticeDemo({
      fileName: 'motion-fastest-lap-com-volta.html',
      group: 'Melhor volta',
      variant: 'com a volta',
      ownHtml: renderFastestLap(sample.fastestLap),
      ownKind: 'fastest-lap',
    }),
    buildNoticeDemo({
      fileName: 'motion-fastest-lap-sem-volta.html',
      group: 'Melhor volta',
      variant: 'sem a volta',
      ownHtml: renderFastestLap(fastestLapWithoutLap),
      ownKind: 'fastest-lap',
    }),
    buildNoticeDemo({
      fileName: 'motion-penalty-notice-com-sancao.html',
      group: 'Penalidade ou incidente',
      variant: 'com sanção',
      ownHtml: renderPenaltyNotice(sample.notices.penalty),
      ownKind: 'penalty',
    }),
    buildNoticeDemo({
      fileName: 'motion-penalty-notice-sem-sancao.html',
      group: 'Penalidade ou incidente',
      variant: 'sem sanção',
      ownHtml: renderPenaltyNotice(penaltyWithoutSanction),
      ownKind: 'penalty',
    }),
  ];
}

export function listCountdownDemos() {
  const config = { remainingSeconds: sample.countdown.remainingSeconds };
  return [
    {
      fileName: 'motion-countdown.html',
      group: 'Contagem regressiva',
      variant: 'cartão (camada do relógio)',
      demoName: 'countdown',
      family: 'Cards',
      actions: ['enter', 'exit'],
      stage: renderCountdownCard(sample.countdown),
      config,
    },
    {
      fileName: 'motion-countdown-tela-cheia.html',
      group: 'Contagem regressiva',
      variant: 'tela cheia',
      demoName: 'countdown-board',
      family: 'Boards',
      actions: ['enter', 'exit'],
      stage: renderCountdownBoard(sample.countdown, sample.session),
      config,
    },
  ];
}

// Message ticker: its clock block is optional.
export function listMessageTickerDemos() {
  return [true, false].map((withClock) => ({
    fileName: `motion-message-ticker-${withClock ? 'com' : 'sem'}-relogio.html`,
    group: 'Mensagens',
    variant: `${withClock ? 'com' : 'sem'} relógio`,
    demoName: 'message-ticker',
    family: 'Cards',
    actions: ['enter', 'exit'],
    stage: renderMessageTicker(sample.messages, sample.session, 1, { withClock }),
    config: { messages: sample.messages },
  }));
}

export function listQrDemos() {
  return [
    {
      fileName: 'motion-qr-card.html',
      group: 'QR',
      variant: 'cartão claro',
      demoName: 'qr-card',
      family: 'Cards',
      actions: ['enter', 'exit'],
      stage: renderQrCard(sample.qr),
    },
  ];
}
