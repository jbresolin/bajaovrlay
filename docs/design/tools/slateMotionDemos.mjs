// The catalogue's motion demos, listed (BAJAOVRLAY-43): one entry per graphic and per
// combination of its optional parts, each with the buttons to judge it, the graphic as the
// static pages draw it, the states a button brings in (as <template>s) and the demo's data.
// The entries are built in slateMotionCardDemos.mjs and slateMotionBoardDemos.mjs;
// slateMotionPages.mjs turns each into a page. Every value shown comes from sample-data.json.
import {
  listBracketDemos,
  listIntermissionDemos,
  listPodiumDemos,
  listSessionsDemos,
  listSponsorRollDemos,
  listStandingsDemos,
} from './slateMotionBoardDemos.mjs';
import {
  listBattleCardDemos,
  listCountdownDemos,
  listMessageTickerDemos,
  listNoticeDemos,
  listQrDemos,
  listTeamCardDemos,
} from './slateMotionCardDemos.mjs';

/** Every demo of the catalogue, in the catalogue's order (catalogue.md). */
export function listMotionDemos(options) {
  return [
    ...listTeamCardDemos(),
    ...listBattleCardDemos(),
    ...listStandingsDemos(options),
    ...listBracketDemos(),
    ...listPodiumDemos(),
    ...listNoticeDemos(),
    ...listCountdownDemos(),
    ...listSessionsDemos(),
    ...listIntermissionDemos(),
    ...listSponsorRollDemos(options),
    ...listQrDemos(),
    ...listMessageTickerDemos(),
  ];
}
