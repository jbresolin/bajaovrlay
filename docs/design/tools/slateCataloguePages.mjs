// Assembles the pages of the catalogue (BAJAOVRLAY-43, pass 2) from the builders of
// slateNotices.mjs, slateCards.mjs, slateBoards.mjs and slateSteps.mjs, and the two sheets
// of slateCatalogueSheets.mjs; slatePages.mjs merges them with the pages of pass 1. One page
// per graphic, one per step for the bracket and the podium, and the three combinations the
// layer plan names (catalogue.md).
import {
  renderCountdownBoard,
  renderIntermissionBoard,
  renderSessionsBoard,
  renderSponsorRollBoard,
  renderStandingsBoard,
  renderStandingsEventBoard,
} from './slateBoards.mjs';
import {
  renderBattleCard,
  renderCountdownCard,
  renderMessageTicker,
  renderQrCard,
  renderSponsorRollCorner,
  renderTeamCard,
} from './slateCards.mjs';
import {
  renderSheetBattle,
  renderSheetBracketResults,
  renderSheetNotices,
} from './slateCatalogueSheets.mjs';
import { renderFastestLap, renderPenaltyNotice } from './slateNotices.mjs';
import { renderBracket, renderPodium } from './slateSteps.mjs';
import {
  pageShell,
  renderCompactTower,
  renderLowerThird,
  renderRaceClock,
  renderSponsorBug,
  sample,
} from './slateTemplates.mjs';

/**
 * Builds the catalogue's pages of one direction: a map of file name to HTML. Options: name
 * (the folder name), compactRows, standingsRowsPerPage, standingsRowsPerColumn and
 * sponsorsPerPage.
 */
export function buildCataloguePages(options) {
  const { name, compactRows, standingsRowsPerPage, standingsRowsPerColumn, sponsorsPerPage } =
    options;
  const shell = (title, body) => pageShell(name, title, body);
  const compactCars = sample.positions.slice(0, compactRows);
  const eventName = sample.session.eventName;
  const topFive = sample.standingsTop5;
  const sponsorsOnTheBoard = sample.sponsors.slice(0, 4);

  return {
    'team-card.html': shell('team card', renderTeamCard(sample.teamCards.withMedia)),
    'team-card-sem-foto.html': shell(
      'team card without photo and logo',
      renderTeamCard(sample.teamCards.withoutMedia),
    ),
    'battle-card.html': shell('battle card', renderBattleCard(sample.battle, 'closing')),
    'standings.html': shell(
      'standings',
      renderStandingsBoard(sample.standings, eventName, 1, standingsRowsPerPage),
    ),
    'standings-por-prova.html': shell(
      'standings of one event',
      renderStandingsEventBoard(sample.standingsEnduro, eventName, standingsRowsPerColumn),
    ),
    'bracket-passo-1.html': shell('bracket, step 1', renderBracket(sample.brackets, 1)),
    'bracket-passo-2.html': shell('bracket, step 2', renderBracket(sample.brackets, 2)),
    'bracket-passo-3.html': shell('bracket, step 3', renderBracket(sample.brackets, 3)),
    'bracket-64-passo-1.html': shell(
      'bracket of 64, step 1: the first round as a board, the top four seeds by W.O.',
      renderBracket(sample.bracket64, 1),
    ),
    'bracket-64-passo-2.html': shell(
      'bracket of 64, step 2: the second round as a board, one W.O.',
      renderBracket(sample.bracket64, 2),
    ),
    'bracket-64-passo-6.html': shell(
      'bracket of 64, step 6: the tree from the quarter-finals, one W.O.',
      renderBracket(sample.bracket64, 6),
    ),
    'podium-passo-1.html': shell('podium, step 1', renderPodium(sample.podium, 1)),
    'podium-passo-2.html': shell('podium, step 2', renderPodium(sample.podium, 2)),
    'podium-passo-3.html': shell('podium, step 3', renderPodium(sample.podium, 3)),
    'fastest-lap.html': shell('fastest lap', renderFastestLap(sample.fastestLap)),
    'penalty-notice.html': shell('penalty notice', renderPenaltyNotice(sample.notices.penalty)),
    'countdown.html': shell('countdown', renderCountdownCard(sample.countdown)),
    'countdown-tela-cheia.html': shell(
      'countdown, full screen',
      renderCountdownBoard(sample.countdown, sample.session),
    ),
    'sessions-board.html': shell(
      'sessions board',
      renderSessionsBoard(sample.schedule, sample.session),
    ),
    'intermission-board.html': shell(
      'intermission board',
      renderIntermissionBoard(sample.session, sample.countdown, topFive, sponsorsOnTheBoard),
    ),
    'sponsor-roll.html': shell(
      'sponsor roll, full screen',
      renderSponsorRollBoard(sample.sponsors, 1, sponsorsPerPage),
    ),
    'sponsor-roll-canto.html': shell(
      'sponsor roll, corner',
      renderSponsorRollCorner(sample.sponsorBug, sample.sponsors[0]),
    ),
    'qr-card.html': shell('QR card', renderQrCard(sample.qr)),
    'message-ticker.html': shell(
      'message ticker',
      renderMessageTicker(sample.messages, sample.session, 1),
    ),
    'combo-fastest-lap.html': shell(
      'combo: clock, tower, bug and fastest lap',
      [
        renderRaceClock(sample.session),
        renderCompactTower(compactCars, sample.session),
        renderSponsorBug(sample.sponsorBug),
        renderFastestLap(sample.fastestLap),
      ].join('\n'),
    ),
    'combo-battle.html': shell(
      'combo: clock, bug and battle card',
      [
        renderRaceClock(sample.session),
        renderSponsorBug(sample.sponsorBug),
        renderBattleCard(sample.battle, 'closing'),
      ].join('\n'),
    ),
    'combo-ticker.html': shell(
      'combo: lower third and message ticker',
      [
        renderMessageTicker(sample.messages, sample.session, 1),
        renderLowerThird(sample.people[1]),
      ].join('\n'),
    ),
    'sheet-battle.html': shell('sheet battle', renderSheetBattle(name)),
    'sheet-notices.html': shell('sheet notices', renderSheetNotices(name)),
    'sheet-bracket-results.html': shell('sheet bracket results', renderSheetBracketResults(name)),
  };
}
