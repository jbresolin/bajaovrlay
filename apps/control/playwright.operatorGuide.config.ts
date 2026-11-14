import { defineConfig, devices } from '@playwright/test';

// The operator guide's scripts (BAJAOVRLAY-31, docs/operador/README.md), run with
// `pnpm --filter @bajaovrlay/control operator-guide` after `pnpm build`:
// - "fotos" (docs/operador/screenshots.e2e.ts) retakes the guide's pictures from a server of
//   its own with the simulator, and writes them to docs/operador/imagens/;
// - "impressao" (docs/operador/guidePrintsOnTwoPages.e2e.ts), after it, prints the guide to
//   A4, checks it fits two pages, and writes docs/operador/guia-do-operador.pdf.
// The two-page check also runs with the other browser tests (playwright.config.ts), where it
// writes nothing. Nothing here starts a server: the pictures' script starts its own.
const isRunningInCI = Boolean(process.env.CI);

// The pictures wait on a real race: a Super Prime match decided, Super Chats arriving.
const longestTheScriptMayTakeInMilliseconds = 180_000;

export default defineConfig({
  testDir: '../../docs/operador',
  forbidOnly: isRunningInCI,
  // No retries: a picture that fails to come is a bug in the script or in the page.
  retries: 0,
  workers: 1,
  timeout: longestTheScriptMayTakeInMilliseconds,
  reporter: 'list',
  // Under test-results/, which .gitignore already leaves out.
  outputDir: 'test-results/operator-guide',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'fotos',
      testMatch: 'screenshots.e2e.ts',
      // The operator's desktop browser, at the size the other control page tests use, drawn
      // at twice the pixels so the pictures stay sharp on paper.
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 900 },
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'impressao',
      testMatch: 'guidePrintsOnTwoPages.e2e.ts',
      // After the pictures, so the PDF holds the new ones.
      dependencies: ['fotos'],
      use: { ...devices['Desktop Chrome'] },
      // Read by the test: this run writes the PDF into docs/operador/.
      metadata: { savesThePrintedGuide: true },
    },
  ],
});
