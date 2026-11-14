// Every port the browser tests open, before BAJAOVRLAY_E2E_PORT_OFFSET moves it, with the
// file that writes it as `<port> + portOffsetOfTheBrowserTests` (BAJAOVRLAY-72). The one
// list checkPortOffset.js reads to refuse an offset that moves a port onto one Windows
// holds. The files keep their own number, so this list can drift from them:
// browserTestPorts.test.ts reads every file and fails when a port is added, moved or
// removed without this list. One row per use, so a port two files write has two rows.

/** @type {{ port: number, file: string }[]} */
export const browserTestPorts = [
  // The graphics' preview servers (one per graphic's playwright.config.ts).
  { port: 5176, file: 'packages/graphics/race-clock/playwright.config.ts' },
  { port: 5178, file: 'packages/graphics/positions-tower/playwright.config.ts' },
  { port: 5180, file: 'packages/graphics/notice/playwright.config.ts' },
  { port: 5191, file: 'packages/graphics/lower-third/playwright.config.ts' },
  { port: 5193, file: 'packages/graphics/team-card/playwright.config.ts' },
  { port: 5195, file: 'packages/graphics/standings/playwright.config.ts' },
  { port: 5197, file: 'packages/graphics/sponsor-bug/playwright.config.ts' },
  { port: 5199, file: 'packages/graphics/lower-strip/playwright.config.ts' },
  { port: 5201, file: 'packages/graphics/message-ticker/playwright.config.ts' },
  { port: 5203, file: 'packages/graphics/podium/playwright.config.ts' },
  { port: 5205, file: 'packages/graphics/battle-card/playwright.config.ts' },
  { port: 5207, file: 'packages/graphics/qr-card/playwright.config.ts' },
  { port: 5211, file: 'packages/graphics/countdown/playwright.config.ts' },
  { port: 5213, file: 'packages/graphics/sessions-board/playwright.config.ts' },
  { port: 5215, file: 'packages/graphics/sponsor-roll/playwright.config.ts' },
  { port: 5217, file: 'packages/graphics/intermission-board/playwright.config.ts' },
  { port: 5221, file: 'packages/graphics/bracket/playwright.config.ts' },
  { port: 5223, file: 'packages/graphics/super-chat/playwright.config.ts' },
  { port: 5225, file: 'packages/graphics/logo-bug/playwright.config.ts' },
  { port: 5227, file: 'packages/graphics/bracket-match-bug/playwright.config.ts' },
  { port: 5229, file: 'packages/graphics/bracket-match-card/playwright.config.ts' },
  // The plain sponsor roll shares 5231 with the chaos suite's first console proxy below.
  // They never run at the same time (the chaos suite runs last in `pnpm verify` and in a
  // CI job of its own), so it is left as it is.
  { port: 5231, file: 'packages/graphics/sponsor-roll-plain/playwright.config.ts' },

  // The control page's browser tests and the servers they start.
  { port: 5181, file: 'apps/control/e2e/loginServerOfTheBrowserTests.ts' },
  { port: 5187, file: 'apps/control/e2e/emptyTheServerState.ts' },
  { port: 5188, file: 'apps/control/playwright.config.ts' },
  { port: 5189, file: 'apps/control/e2e/eventInboxAfterARestart.e2e.ts' },
  { port: 5190, file: 'apps/control/e2e/plainSponsorRollEveryFiveMinutes.e2e.ts' },

  // The chaos suite's server and its three proxies.
  { port: 5230, file: 'apps/control/e2e/chaos/steps/chaosPorts.ts' },
  { port: 5231, file: 'apps/control/e2e/chaos/steps/chaosPorts.ts' },
  { port: 5232, file: 'apps/control/e2e/chaos/steps/chaosPorts.ts' },
  { port: 5233, file: 'apps/control/e2e/chaos/steps/chaosPorts.ts' },

  // The renderer's page and its real server, and the server's built-server test.
  { port: 5184, file: 'apps/renderer/e2e/realServer.ts' },
  { port: 5185, file: 'apps/renderer/e2e/realServer.ts' },
  { port: 5186, file: 'apps/server/e2e/builtServer.ts' },
];
