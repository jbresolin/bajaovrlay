// The reference sheets of the catalogue (BAJAOVRLAY-43), not on-air compositions: the battle
// card in its three trends, and every notice beside the clock with a red flag, to show that
// a notice cannot be mistaken for the flag band. Drawn with the on-air builders, like the
// sheets of slateSheets.mjs, so a sheet never drifts from the graphics.
import { renderBattleCard } from './slateCards.mjs';
import { renderFastestLap, renderPenaltyNotice } from './slateNotices.mjs';
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
