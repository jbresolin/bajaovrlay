// The motion demos of the catalogue's boards (BAJAOVRLAY-43): standings, sessions board,
// intermission board, sponsor roll (full screen and corner), bracket and podium, one entry
// per combination of each graphic's optional parts. slateMotionDemos.mjs lists them with the
// cards' in the catalogue's order; the browser side is motionDemoBoards.js (and
// motionDemoCards.js for the corner sponsor roll).
import {
  planSponsorPages,
  renderBoardHead,
  renderIntermissionBoard,
  renderSessionsBoard,
  renderSessionStatus,
  renderSponsorRollBoard,
  renderSponsorRollGrid,
  renderStandingsBoard,
  renderStandingsEventBoard,
  renderStandingsPageRows,
  writeSponsorPageSubtitle,
  writeStandingsPageAside,
} from './slateBoards.mjs';
import { renderSponsorRollCorner, renderSponsorRollCornerCell } from './slateCards.mjs';
import {
  describeParts,
  everyCombination,
  renderTemplate,
  slugOf,
} from './slateMotionDemoParts.mjs';
import {
  planBracketSteps,
  renderBracketBoardBody,
  renderBracketTreeBody,
  renderPodium,
  writeBracketStepSubtitle,
} from './slateSteps.mjs';
import { sample } from './slateTemplates.mjs';

export function listStandingsDemos(options) {
  const { standingsRowsPerPage, standingsRowsPerColumn } = options;
  const { standings } = sample;
  const pageCount = Math.ceil(standings.entries.length / standingsRowsPerPage);
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);
  const eventName = sample.session.eventName;
  return [
    {
      fileName: 'motion-standings-pontos-por-prova.html',
      group: 'Classificação',
      variant: 'geral com pontos por prova, em páginas',
      demoName: 'standings',
      family: 'Boards',
      actions: ['enter', 'exit'],
      stage: renderStandingsBoard(standings, eventName, 1, standingsRowsPerPage),
      templates: pageNumbers.map((pageNumber) =>
        renderTemplate(
          `standings-page-${pageNumber}`,
          renderStandingsPageRows(standings, pageNumber, standingsRowsPerPage),
        ),
      ),
      config: {
        pages: pageNumbers.map((pageNumber) => ({
          template: `standings-page-${pageNumber}`,
          aside: writeStandingsPageAside(standings, pageNumber, standingsRowsPerPage),
        })),
      },
    },
    {
      fileName: 'motion-standings-so-total.html',
      group: 'Classificação',
      variant: 'geral só com o total, em colunas',
      demoName: 'standings-columns',
      family: 'Boards',
      actions: ['enter', 'exit'],
      stage: renderStandingsEventBoard(standings, eventName, standingsRowsPerColumn),
    },
    {
      fileName: 'motion-standings-por-prova.html',
      group: 'Classificação',
      variant: 'de uma prova, em colunas',
      demoName: 'standings-columns',
      family: 'Boards',
      actions: ['enter', 'exit'],
      stage: renderStandingsEventBoard(sample.standingsEnduro, eventName, standingsRowsPerColumn),
    },
  ];
}

export function listSessionsDemos() {
  const statusLabelOf = (status) =>
    sample.schedule.find((slot) => slot.status === status).statusLabel;
  return [
    {
      fileName: 'motion-sessions-board.html',
      group: 'Programação do dia',
      variant: 'a sessão em andamento avança',
      demoName: 'sessions-board',
      family: 'Boards',
      actions: ['enter', 'exit', 'update'],
      stage: renderSessionsBoard(sample.schedule, sample.session),
      templates: ['done', 'live', 'next'].map((status) =>
        renderTemplate(`status-${status}`, renderSessionStatus(status, statusLabelOf(status))),
      ),
    },
  ];
}

// Intermission: the top five and the sponsor line are each optional.
export function listIntermissionDemos() {
  const partNames = ['classificação', 'patrocinadores'];
  return everyCombination(2).map(([withTopFive, withSponsors]) => {
    const words = describeParts(partNames, [withTopFive, withSponsors]);
    return {
      fileName: `motion-intermission-${slugOf(words)}.html`,
      group: 'Intervalo',
      variant: words.join(', '),
      demoName: 'intermission',
      family: 'Boards',
      actions: ['enter', 'exit'],
      stage: renderIntermissionBoard(
        sample.session,
        sample.countdown,
        withTopFive ? sample.standingsTop5 : [],
        withSponsors ? sample.sponsors.slice(0, 4) : [],
      ),
      config: { remainingSeconds: sample.countdown.remainingSeconds },
    };
  });
}

export function listSponsorRollDemos(options) {
  const { sponsorsPerPage } = options;
  const { sponsors, sponsorBug } = sample;
  // One sponsor level a page, as the static pages plan them (planSponsorPages).
  const pageCount = planSponsorPages(sponsors, sponsorsPerPage).length;
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);
  const sponsorIds = sponsors.map((_, index) => `sponsor-${index + 1}`);
  return [
    {
      fileName: 'motion-sponsor-roll.html',
      group: 'Patrocinadores',
      variant: 'tela cheia',
      demoName: 'sponsor-roll',
      family: 'Boards',
      actions: ['enter', 'exit', 'update'],
      stage: renderSponsorRollBoard(sponsors, 1, sponsorsPerPage),
      templates: pageNumbers.map((pageNumber) =>
        renderTemplate(
          `sponsor-page-${pageNumber}`,
          renderSponsorRollGrid(sponsors, pageNumber, sponsorsPerPage),
        ),
      ),
      config: {
        pages: pageNumbers.map((pageNumber) => ({
          template: `sponsor-page-${pageNumber}`,
          aside: `${pageNumber}/${pageCount}`,
          subtitle: writeSponsorPageSubtitle(sponsors, pageNumber, sponsorsPerPage),
        })),
      },
    },
    {
      fileName: 'motion-sponsor-roll-canto.html',
      group: 'Patrocinadores',
      variant: 'no canto',
      demoName: 'sponsor-roll-corner',
      family: 'Cards',
      actions: ['enter', 'exit', 'update'],
      stage: renderSponsorRollCorner(sponsorBug, sponsors[0]),
      templates: sponsors.map((sponsor, index) =>
        renderTemplate(sponsorIds[index], renderSponsorRollCornerCell(sponsorBug, sponsor)),
      ),
      config: { sponsorTemplates: sponsorIds },
    },
  ];
}

// A bracket's steps as the demo walks them: the boards' bodies and the whole tree as
// templates, the head's words per step; the tree reveals one round per step (revealsRound:
// a round's index, or "third" for the third-place match, which comes before the final).
function buildBracketDemo(brackets, { fileName, variant }) {
  const steps = planBracketSteps(brackets.rounds, 32);
  const revealedRoundOf = (step, index) => {
    if (step.kind !== 'tree') return undefined;
    const previous = steps[index - 1];
    const isThirdPlaceStep = step.isThirdPlaceShown && !previous?.isThirdPlaceShown;
    return isThirdPlaceStep ? 'third' : step.roundsShown - 1;
  };
  const stepConfigs = steps.map((step, index) => ({
    kind: step.kind,
    template: step.kind === 'board' ? `bracket-step-${index + 1}` : undefined,
    revealsRound: revealedRoundOf(step, index),
    subtitle: writeBracketStepSubtitle(step),
    aside: `${index + 1}/${steps.length}`,
  }));
  const treeStep = steps.find((step) => step.kind === 'tree');
  const boardTemplates = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.kind === 'board')
    .map(({ step, index }) =>
      renderTemplate(`bracket-step-${index + 1}`, renderBracketBoardBody(step)),
    );
  const head = renderBoardHead(brackets.title, stepConfigs[0].subtitle, stepConfigs[0].aside);
  return {
    fileName,
    group: 'Chave eliminatória',
    variant,
    demoName: 'bracket',
    family: 'Boards',
    actions: ['enter', 'exit', 'next'],
    stage: `<section class="board bracket" data-graphic="bracket">
${head}
  <div class="bracket__body"></div>
</section>`,
    templates: [
      ...boardTemplates,
      renderTemplate(
        'bracket-tree',
        renderBracketTreeBody(
          treeStep.rounds,
          treeStep.rounds.length,
          treeStep.thirdPlaceRound,
          true,
        ),
      ),
    ],
    config: { steps: stepConfigs, treeTemplate: 'bracket-tree' },
  };
}

export function listBracketDemos() {
  return [
    buildBracketDemo(sample.brackets, {
      fileName: 'motion-bracket.html',
      variant: 'Super Prime real: 32 avos em lista até a final, com a disputa de 3º',
    }),
  ];
}

export function listPodiumDemos() {
  return [
    {
      fileName: 'motion-podium.html',
      group: 'Pódio',
      variant: '3º, 2º e 1º com Próximo',
      demoName: 'podium',
      family: 'Boards',
      actions: ['enter', 'exit', 'next'],
      stage: renderPodium(sample.podium, 3),
    },
  ];
}
