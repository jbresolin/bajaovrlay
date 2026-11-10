import {
  type Graphic,
  measurePlainSponsorRollPassMs,
  sponsorLevelsInRoundOrder,
  type SponsorOfThePass,
} from '@bajaovrlay/shared';

/**
 * A named rule that works out, from the data a take puts on air, how long the graphic stays
 * before the auto-out takes it off (BAJAOVRLAY-64). A manifest chooses one by name in
 * `v_baja.autoOutRule`: a named pure function, never an expression (architecture rule 5).
 */
type AutoOutRule = (dataOnAir: Record<string, unknown>) => number | undefined;

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
  onePlainSponsorRollPass: (dataOnAir) =>
    measurePlainSponsorRollPassMs(readSponsorsOfThePass(dataOnAir)),
};

/**
 * How long a take of this graphic with this data stays on air by its manifest's auto-out
 * rule, in ms, or undefined when the manifest names none, or a rule the server does not know.
 */
export function findAutoOutByTheGraphicsRule(
  graphic: Graphic,
  dataOnAir: Record<string, unknown>,
): number | undefined {
  const ruleName = graphic.manifest.v_baja?.autoOutRule;
  if (ruleName === undefined) {
    return undefined;
  }
  const rule = autoOutRuleOfEachName[ruleName];
  return rule === undefined ? undefined : rule(dataOnAir);
}
