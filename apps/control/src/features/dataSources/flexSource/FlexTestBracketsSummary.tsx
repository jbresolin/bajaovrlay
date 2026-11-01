import type { BracketsShape } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.dataSources.flexForm.test;

/**
 * The brackets a "Testar" produced, as a plain list of the rounds in order with their
 * match counts ("Semifinais: 2 disputas"). The source detail has no brackets table, so
 * this says what the operator most needs to check: which rounds came through, whole and in
 * order, the third place before the final (BAJAOVRLAY-53's contracts A and C).
 */
export function FlexTestBracketsSummary(props: { brackets: BracketsShape }) {
  return (
    <section aria-label={texts.bracketsTitle} className="flex flex-col gap-1">
      <h5 className="text-sm font-medium">{texts.bracketsTitle}</h5>
      <ol className="list-decimal pl-5 text-sm">
        {props.brackets.rounds.map((round) => (
          <li key={round.name}>{texts.bracketsRound(round.name, round.matches.length)}</li>
        ))}
      </ol>
    </section>
  );
}
