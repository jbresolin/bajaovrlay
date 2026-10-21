// The reference sheets of a slate direction, not on-air compositions: the clock in every flag
// state, the status icons with real rows, and the detailed tower's column sets. They draw
// with the on-air builders of slateTemplates.mjs so a sheet never drifts from the graphics.
import {
  defaultDetailedColumns,
  flagOrder,
  flagStateLabels,
  flagWords,
  largeIcon,
  renderCompactTower,
  renderDetailedTower,
  renderFlagPill,
  renderRaceClock,
  sample,
  statusShapeWords,
} from './slateTemplates.mjs';
import { escapeHtml } from './slateVocabulary.mjs';

// ---------------------------------------------------------------- reference sheets

export function renderSheetFlags(direction) {
  const clocks = flagOrder
    .map((flag) => {
      const session = flag === 'yellow' ? sample.sessionYellow : sample.session;
      return `    <div class="sheet__cell">
      <div class="sheet__label">${flagStateLabels[flag]}</div>
${renderRaceClock(session, flag, flagWords[flag], { withRoot: false })}
    </div>`;
    })
    .join('\n');
  const pills = flagOrder.map((flag) => renderFlagPill(flag, flagWords[flag])).join('\n      ');
  const withoutFlag = `    <div class="sheet__cell">
      <div class="sheet__label">sem bandeira (a faixa é opcional)</div>
${renderRaceClock(sample.session, sample.session.flag, sample.session.flagLabel, { withRoot: false, withFlag: false })}
    </div>`;
  return `<div class="sheet">
  <div class="sheet__title">${direction} · bandeiras — o relógio nos seis estados e sem bandeira (folha de referência, não vai ao ar)</div>
  <div class="sheet__grid sheet__grid--flags">
${clocks}
${withoutFlag}
  </div>
  <div class="sheet__label">a pílula da faixa inferior nos seis estados</div>
  <div class="card sheet__pills">
      ${pills}
  </div>
</div>`;
}

export function renderSheetStatus(direction) {
  const byCar = (carNumber) => sample.positions.find((car) => car.carNumber === carNumber);
  const statusCars = [byCar(69), byCar(65), byCar(96)];
  const icons = statusCars
    .map(
      (car) => `    <div class="card sheet__icon-cell">
      <div class="sheet__icon-frame">${largeIcon(car.status)}</div>
      <div class="sheet__icon-caption"><span class="sheet__icon-label">${escapeHtml(car.statusLabel)}</span><span class="caption">${statusShapeWords[car.status]}</span></div>
    </div>`,
    )
    .join('\n');
  return `<div class="sheet">
  <div class="sheet__title">${direction} · situação do carro — três formas numa coluna fixa; a forma carrega o significado, nunca só a cor (folha de referência, não vai ao ar)</div>
  <div class="sheet__icons">
${icons}
  </div>
  <div class="sheet__rows">
    <div class="sheet__cell">
      <div class="sheet__label">linhas da torre compacta · carro 69 no box, 65 quebrado, 96 abandonou (linha esmaecida)</div>
${renderCompactTower(statusCars, sample.session, { withRoot: false })}
    </div>
    <div class="sheet__cell">
      <div class="sheet__label">as mesmas linhas na torre detalhada</div>
${renderDetailedTower(statusCars, sample.session, { withRoot: false })}
    </div>
  </div>
</div>`;
}

// The columns sheet: the detailed tower with every column, with the default set, and with the
// optional columns off (an event without lap timing, refuels or status), four cars each.
export function renderSheetColumns(direction) {
  const cars = sample.positions.slice(0, 4);
  const everyColumn = ['gap', 'interval', 'last-lap', 'best-lap', 'pit-stops', 'refuels', 'status'];
  const cell = (label, columns) => `    <div class="sheet__cell">
      <div class="sheet__label">${label}</div>
${renderDetailedTower(cars, sample.session, { withRoot: false, columns })}
    </div>`;
  return `<div class="sheet">
  <div class="sheet__title">${direction} · colunas da torre detalhada — as cinco primeiras são fixas, as outras são opcionais (folha de referência, não vai ao ar)</div>
  <div class="sheet__rows">
${cell('todas as colunas: ABAST. mostra "—" porque a forma canônica ainda não traz reabastecimentos', everyColumn)}
${cell('padrão: tempos, PARADAS (entradas no box) e situação', defaultDetailedColumns)}
${cell('evento sem cronometragem por volta: só VOLTAS e PARADAS', ['pit-stops'])}
${cell('só o essencial: nenhuma coluna opcional', [])}
  </div>
</div>`;
}
