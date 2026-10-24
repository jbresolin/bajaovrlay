// The reference sheets of the catalogue (BAJAOVRLAY-43), not on-air compositions: the battle
// card in its three trends, and every notice beside the clock with a red flag, to show that
// a notice cannot be mistaken for the flag band. Drawn with the on-air builders, like the
// sheets of slateSheets.mjs, so a sheet never drifts from the graphics.
import { renderBattleCard } from './slateCards.mjs';
import { renderFastestLap, renderPenaltyNotice } from './slateNotices.mjs';
import { renderBracketMatch } from './slateSteps.mjs';
import { renderRaceClock, sample } from './slateTemplates.mjs';

export function renderSheetBattle(direction) {
  const cell = (label, trend) => `    <div class="sheet__cell">
      <div class="sheet__label">${label}</div>
${renderBattleCard(sample.battle, trend, { withRoot: false })}
    </div>`;
  return `<div class="sheet">
  <div class="sheet__title">${direction} · disputa — a diferença fechando, abrindo e estável: palavra, variação com sinal e forma, nunca só a cor (folha de referência, não vai ao ar)</div>
  <div class="sheet__grid--battle">
${cell('fechando: o carro de trás ganhou 0,7 na última volta', 'closing')}
${cell('abrindo: o carro da frente ganhou 0,7 na última volta', 'opening')}
${cell('estável: a diferença não mudou', 'steady')}
  </div>
</div>`;
}

// Every kind of result a match can carry. The real Super Prime gives three: its only raced
// first-round match (a win with no number), its best-of-3 third-place match, and a bye. The
// other states use that first-round match's two cars: with times (from the packages/shared
// suspension sample, since Super Prime records none), won by W.O. because the opponent did
// not run (none did in the export), and undecided. Each in the tree and on a board.
export function renderSheetBracketResults(direction) {
  const [firstRound] = sample.brackets.rounds;
  const asPlainWin = firstRound.matches.find((match) => match.carB !== undefined);
  const asBye = firstRound.matches.find((match) => match.carB === undefined);
  const asBestOfThree = sample.brackets.rounds.find((round) => round.isThirdPlace).matches[0];
  const timed = {
    ...asPlainWin,
    carA: { ...asPlainWin.carA, timeText: sample.bracketTimedSample.carA.timeText },
    carB: { ...asPlainWin.carB, timeText: sample.bracketTimedSample.carB.timeText },
  };
  const asNoShowWalkover = { ...asPlainWin, walkover: true };
  const undecided = { ...asPlainWin, winnerCarNumber: undefined };
  const state = (label, match) => `    <div class="sheet__state">
      <div class="sheet__label">${label}</div>
      <div class="sheet__state-forms">
${renderBracketMatch(match)}
${renderBracketMatch(match, { layout: 'board' })}
      </div>
    </div>`;
  return `<div class="sheet">
  <div class="sheet__title">${direction} · resultados de uma disputa — na árvore (à esquerda) e numa rodada em lista (à direita) (folha de referência, não vai ao ar)</div>
  <div class="sheet__states">
${state('tempo por carro: prova cronometrada', timed)}
${state('melhor de 3: a contagem de vitórias no lugar do tempo', asBestOfThree)}
${state('vitória sem número: só a marca do vencedor', asPlainWin)}
${state('W.O.: o adversário não correu (em qualquer rodada)', asNoShowWalkover)}
${state('W.O. sem adversário: a vaga vazia de uma chave incompleta', asBye)}
${state('antes de decidir: "—" nos dois', undecided)}
  </div>
</div>`;
}

export function renderSheetNotices(direction) {
  const cell = (label, html) => `    <div class="sheet__cell">
      <div class="sheet__label">${label}</div>
${html}
    </div>`;
  const redFlagClock = renderRaceClock(sample.session, 'red', 'VERMELHA', { withRoot: false });
  return `<div class="sheet">
  <div class="sheet__title">${direction} · avisos — a melhor volta e as penalidades reais do enduro (penalizacoes.csv); e o relógio com bandeira vermelha ao lado, para ver que um aviso não parece uma bandeira (folha de referência, não vai ao ar)</div>
  <div class="sheet__grid--notices">
${cell('melhor volta', renderFastestLap(sample.fastestLap, { withRoot: false }))}
${cell('bandeira amarela não respeitada (5 min)', renderPenaltyNotice(sample.notices.yellowFlag, { withRoot: false }))}
${cell('desvio de obstáculo (2 min)', renderPenaltyNotice(sample.notices.obstacle, { withRoot: false }))}
${cell('combustível derramado (5 min)', renderPenaltyNotice(sample.notices.fuel, { withRoot: false }))}
${cell('antes da largada (15 min)', renderPenaltyNotice(sample.notices.beforeTheRace, { withRoot: false }))}
${cell('o relógio com bandeira vermelha, para comparar', redFlagClock)}
  </div>
</div>`;
}
