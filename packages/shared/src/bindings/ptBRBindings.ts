/**
 * The pt-BR texts of bindings that shared code writes: why a binding does not make sense,
 * why it does not fit a field, and why it cannot be resolved now. They live in shared,
 * like ptBRDataShapes.ts, because the server's refusals and the item editor's live line
 * show the same sentence.
 */
export const ptBRBindings = {
  /** Why the parts of one binding do not make sense together. */
  bindingProblems: {
    pathNotOffered: (path: string, shapeName: string) =>
      `O caminho "${path}" não é um dos que a forma ${shapeName} oferece.`,
    carNumberMissing: 'Falta o número do carro a seguir.',
    carNumberOnFixedPlace: (carChosenByNumberLabel: string) =>
      `O número do carro só vale para os caminhos de "${carChosenByNumberLabel}".`,
    parametersWithoutTransform:
      'Há parâmetros de transformação, mas nenhuma transformação escolhida.',
  },

  /** Why a binding does not fit the graphic field it is stored on. */
  fieldFitProblems: {
    valueDoesNotFitField: (pathLabel: string) => `${pathLabel} não serve para este campo.`,
  },
};
