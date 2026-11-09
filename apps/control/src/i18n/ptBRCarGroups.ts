/**
 * The pt-BR texts of a car group in the item editor (BAJAOVRLAY-66), reached as
 * `ptBR.carGroups`: one picker per car in place of the car's fields ("Carro da frente"),
 * by number, by place or typed by hand, the battle card's "Disputa pela Nª posição" and
 * "Campos separados". Each control's name ends with the group's label, so two cars of one
 * graphic never share a name.
 */
export const ptBRCarGroups = {
  wayLabel: (groupLabel: string) => `Como escolher ${groupLabel}`,
  wayOptions: {
    carNumber: 'Pelo número do carro',
    place: 'Pela posição',
    typed: 'Digitado à mão',
  },
  sourceLabel: (groupLabel: string) => `Fonte de ${groupLabel}`,
  carNumberLabel: (groupLabel: string) => `Número do carro — ${groupLabel}`,
  placeLabel: (groupLabel: string) => `Posição — ${groupLabel}`,
  placeOption: (placeNumber: number) => `${placeNumber}º lugar`,
  whenLabel: (groupLabel: string) => `Quando ${groupLabel} lê a fonte`,
  // Above the two cars of a battle: sets the car ahead to the place and the car behind
  // to the next one.
  battleLabel: 'Disputa pela posição',
  battleOption: (placeNumber: number) => `Disputa pela ${placeNumber}ª posição`,
  separateFieldsLabel: 'Campos separados',
  separateFieldsAccessibleName: (groupLabel: string) => `Campos separados — ${groupLabel}`,
  // Why a group shows its fields one by one, when they do not follow one car.
  differentCarsNote: (groupLabel: string) =>
    `Os campos de ${groupLabel} leem carros diferentes, por isso estão separados.`,
  notOnePickNote: (groupLabel: string) =>
    `Os campos de ${groupLabel} não vêm de uma escolha só, por isso estão separados.`,
  // The group's own message when a save finds one of its hidden fields wrong.
  wayMissing: (groupLabel: string) => `Escolha como preencher ${groupLabel}.`,
  sourceMissing: (groupLabel: string) => `Escolha a fonte de ${groupLabel}.`,
  carNumberMissing: (groupLabel: string) =>
    `Digite o número do carro de ${groupLabel} (um número inteiro, a partir de 1).`,
  placeMissing: (groupLabel: string) => `Escolha a posição de ${groupLabel}.`,
  // Under a car picked: what each of its fields reads now.
  valuesNowHeading: 'Valores agora',
};
