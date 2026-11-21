/**
 * pt-BR catalog, "Escolher carros" (BAJAOVRLAY-82, features/quickCarPick): the small box a
 * quick-fire button's chevron or "⋯", or a rundown row's "⋯", opens to pick the cars of an
 * item (the battle card's two) by number or by place, then "Prévia" or "No ar", without
 * opening the item editor. ptBR.ts makes it `ptBR.quickCarPick`.
 */
export const ptBRQuickCarPick = {
  // The entry of the "⋯" menus, and the chevron on a quick-fire button (its name for a
  // screen reader names the item; the eye sees the symbol alone).
  openAction: 'Escolher carros',
  openButton: (itemLabel: string) => `Escolher carros: ${itemLabel}`,
  openSymbol: '▾',
  // The box itself, named with the item it changes.
  boxTitle: (itemLabel: string) => `Escolher carros — ${itemLabel}`,
  // The two ways, as tabs (the second only on a graphic with a car right behind another).
  byNumberTab: 'Por número',
  byPlaceTab: 'Pela posição',
  // "Pela posição": one box, the place the two cars battle for.
  battlePlaceLabel: 'Disputa pela posição',
  battlePlacePlaceholder: 'Nº',
  battlePlaceInvalid: (highestPlace: number) => `Digite uma posição de 1 a ${highestPlace}.`,
  // One suggestion under a number box: the team and where the car runs now.
  carSuggestion: (teamName: string, position: number) => `${teamName} · ${position}º`,
  // Why a number typed cannot be used, under its box.
  carNotInPositions: (carNumber: number, sourceLabel: string) =>
    `O carro ${carNumber} não está nas posições de ${sourceLabel}.`,
  noPositionsYet: (sourceLabel: string) => `${sourceLabel} ainda não mandou posições.`,
  sameCarTwice: 'Escolha carros diferentes.',
  // "Pela posição" for a place whose car behind the source does not list now.
  noCarAtPlaceNow: (placeNumber: number) => `Não há carro na ${placeNumber}ª posição agora.`,
  // The one line of what the cars typed are now, from the live positions.
  readOut: (carTexts: string[]) => `Agora: ${carTexts.join(' × ')}`,
  carNow: (position: number, carNumber: number, teamName: string) =>
    `${position}º ${carNumber} ${teamName}`,
  carNotFoundNow: '—',
  // The source the cars are read from, and whether they keep following it on air.
  sourceLine: (sourceLabel: string, isLive: boolean) =>
    `Fonte: ${sourceLabel} · ${isLive ? 'ao vivo' : 'congelado na entrada'}`,
  noSourceWithPositions:
    'Nenhuma fonte manda posições agora. Escolha a fonte dos carros no editor do item.',
  severalSourcesWithPositions:
    'Mais de uma fonte manda posições: escolha a fonte no editor do item.',
  // While the item is on the program output: a take puts it on air again, the graphic
  // going out and coming back with the new cars (no command changes a live car in place).
  onAirNote: 'Já está no ar: "No ar" troca o gráfico pelo dos carros escolhidos.',
  // The item was deleted (by another console) while the box was open.
  itemGone: 'Este item não existe mais.',
  previewButton: 'Prévia',
  takeButton: 'No ar',
} as const;
