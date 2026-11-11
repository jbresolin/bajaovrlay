import {
  type Graphic,
  planPlainSponsorRollPass,
  sponsorLevelsInRoundOrder,
  type SponsorOfThePass,
} from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';

/**
 * A named rule that works out, from the data a take puts on air, how long the graphic stays
 * before the auto-out takes it off (BAJAOVRLAY-64). A manifest chooses one by name in
 * `v_baja.autoOutRule`: a named pure function, never an expression (architecture rule 5).
 */
type AutoOutRule = (dataOnAir: Record<string, unknown>) => AutoOutReading;

/**
 * What a graphic's auto-out rule says of the data a take puts on air: how long it stays, or
 * that it would show nothing (in pt-BR, why), so the take is refused before anything leaves
 * the layer. `noRule` when the manifest names none, or a name the server does not know.
 */
export type AutoOutReading =
  | { kind: 'onAirFor'; milliseconds: number }
  | { kind: 'nothingToShow'; why: string }
  | { kind: 'noRule' };

/** Whether a value is a level the pass knows; anything else is left out of the pass. */
function isSponsorLevel(value: unknown): value is SponsorOfThePass['level'] {
  return sponsorLevelsInRoundOrder.some((level) => level === value);
}

/**
 * The sponsors of the data, as the pass reads them. The take has already checked the data
 * against the manifest, so each is an object with its level; one that is not is skipped
 * rather than trusted, since a wrong length would cut a sponsor short on air.
 */
function readSponsorsOfThePass(dataOnAir: Record<string, unknown>): SponsorOfThePass[] {
  const sponsors = dataOnAir.sponsors;
  if (!Array.isArray(sponsors)) {
    return [];
  }
  const sponsorsOfThePass: SponsorOfThePass[] = [];
  for (const sponsor of sponsors as unknown[]) {
    if (typeof sponsor !== 'object' || sponsor === null) {
      continue;
    }
    const level: unknown = (sponsor as Record<string, unknown>).level;
    const logoUrl: unknown = (sponsor as Record<string, unknown>).logoUrl;
    if (!isSponsorLevel(level)) {
      continue;
    }
    sponsorsOfThePass.push({ level, logoUrl: typeof logoUrl === 'string' ? logoUrl : undefined });
  }
  return sponsorsOfThePass;
}

// Every auto-out rule the server knows, by the name a manifest gives it. To add one: write
// it here with its tests and a comment.
const autoOutRuleOfEachName: Record<string, AutoOutRule> = {
  // The plain sponsor roll: one pass of its sponsors, measured on shared's one table, the
  // very plan the graphic turns its sponsors on, so the layer is free when the pass ends.
  // Deliberate: the length is fixed at the take. A list changed on air (an edit in
  // Cadastros, "Atualizar no ar") neither extends nor cuts it: the graphic keeps the pass it
  // started, and a pass that grew while on air would hold the layer past what the trigger's
  // interval was planned around.
  // What could go wrong: the wait counts from the take, the graphic's turns from its play, so
  // the last sponsor loses the take's latency (the renderer loading it), the existing
  // auto-out trade-off (autoOut.ts): tens of milliseconds on the stream PC.
  // A list with no logo at all would put an empty pass on air and clear the layer for
  // nothing: the take is refused instead, saying why (gate 2 of PR #59).
  onePlainSponsorRollPass: (dataOnAir) => {
    const pass = planPlainSponsorRollPass(readSponsorsOfThePass(dataOnAir));
    if (pass.sponsorsShown.length === 0) {
      return { kind: 'nothingToShow', why: ptBR.commandErrors.noSponsorWithALogo };
    }
    return { kind: 'onAirFor', milliseconds: pass.passMs };
  },
};

/** Whether the server knows an auto-out rule of this name; the boot warns of one it does not. */
export function isAutoOutRuleKnown(ruleName: string): boolean {
  return Object.hasOwn(autoOutRuleOfEachName, ruleName);
}

/**
 * What the graphic's auto-out rule says of a take with this data: how long it stays on air,
 * that it has nothing to show, or `noRule` when the manifest names none (or a name the
 * server does not know, which the boot has warned of).
 */
export function readAutoOutByTheGraphicsRule(
  graphic: Graphic,
  dataOnAir: Record<string, unknown>,
): AutoOutReading {
  const ruleName = graphic.manifest.v_baja?.autoOutRule;
  if (ruleName === undefined || !isAutoOutRuleKnown(ruleName)) {
    return { kind: 'noRule' };
  }
  const rule = autoOutRuleOfEachName[ruleName];
  return rule === undefined ? { kind: 'noRule' } : rule(dataOnAir);
}
