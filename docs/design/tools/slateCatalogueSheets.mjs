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

// Every kind of result a match can carry, on the same quarter-final of the suspension
// sample: the times as recorded, the same match as best of three, as a win with no number,
// won by W.O. because the opponent did not run, won by W.O. against an empty slot (a bye),
// and undecided. Each in the tree's stacked form and the board's score-line card.
export function renderSheetBracketResults(direction) {
  const timed = sample.brackets.rounds[0].matches[0];
  const asBestOfThree = {
    ...timed,
    bestOf: 3,
    carA: { ...timed.carA, timeText: '', wins: 2 },
    carB: { ...timed.carB, timeText: '', wins: 1 },
  };
  const asPlainWin = {
    ...timed,
    carA: { ...timed.carA, timeText: '' },
    carB: { ...timed.carB, timeText: '' },
  };
  const asNoShowWalkover = {
    ...timed,
    walkover: true,
    carA: { ...timed.carA, timeText: '' },
    carB: { ...timed.carB, timeText: '' },
  };
  const asBye = {
    matchId: timed.matchId,
    walkover: true,
    carA: { ...timed.carA, timeText: '' },
    winnerCarNumber: timed.carA.carNumber,
  };
  const undecided = {
    ...timed,
    winnerCarNumber: undefined,
    carA: { ...timed.carA, timeText: '' },
    carB: { ...timed.carB, timeText: '' },
  };
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
  <div class="sheet__title">${direction} · avisos — melhor volta, penalidade com e sem sanção, incidente; e o relógio com bandeira vermelha ao lado, para ver que um aviso não parece uma bandeira (folha de referência, não vai ao ar)</div>
  <div class="sheet__grid--notices">
${cell('melhor volta', renderFastestLap(sample.fastestLap, { withRoot: false }))}
${cell('penalidade com sanção em tempo', renderPenaltyNotice(sample.notices.penalty, { withRoot: false }))}
${cell('penalidade com bandeira preta', renderPenaltyNotice(sample.notices.blackFlag, { withRoot: false }))}
${cell('incidente sem sanção', renderPenaltyNotice(sample.notices.incident, { withRoot: false }))}
${cell('o relógio com bandeira vermelha, para comparar', redFlagClock)}
  </div>
</div>`;
}
