/**
 * No two packages share a dev or preview port (scripts)
 *
 * What this module is for:
 *   Every app and graphic starts its Vite dev server on a fixed port with strictPort, and
 *   `pnpm dev` starts all of them at once. If two packages write the same port, the second
 *   one exits with "port in use" and pnpm kills every other server, so `pnpm dev` fails
 *   as a whole (SIGKILL). That happened when PR #27 (podium, battle card, QR card) and
 *   PR #28 (countdown, sessions board, sponsor roll) were built side by side and both took
 *   5210–5215; nothing failed until both were on main (fixed in BAJAOVRLAY-50). This test
 *   reads every vite.config.ts and playwright.config.ts under apps/ and packages/ as text
 *   and fails when one port belongs to two packages, so the next clash fails CI instead.
 *
 * What these tests prove:
 *   - On the real repository, no port is written in the configs of two packages.
 *   - The reading finds the configs it should (a reading that found nothing would pass).
 *   - A port is read from Vite's `port: 5202` and from a Playwright config's
 *     `5203 + portOffsetOfTheBrowserTests`, and from nothing else.
 *   - A port shared by two packages is named with both; one package writing its preview
 *     port in both of its configs (as every graphic does) is not a clash.
 *
 * What these tests deliberately do not cover:
 *   - Ports set outside these two files (the renderer's browser tests set theirs in
 *     apps/renderer/e2e/realServer.ts, the server reads PORT from .env).
 *   - Whether a port is free on this machine: that is a running server's business.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRootFolder = fileURLToPath(new URL('..', import.meta.url));
const configFileNames = ['vite.config.ts', 'playwright.config.ts'];
// Folders that hold installed or built copies, never a package's own config.
const foldersNotToLookIn = ['node_modules', 'dist', 'test-results', 'playwright-report'];

// Vite writes `port: 5202,` under server and preview.
const vitePortPattern = /\bport: (\d+)/g;
// A Playwright config writes the port it starts its own server on, moved by the offset:
// `const previewPort = 5203 + portOffsetOfTheBrowserTests;`.
const playwrightPortPattern = /(\d+) \+ portOffsetOfTheBrowserTests/g;

type PortsOfOnePackage = { packageFolder: string; ports: number[] };

/** Every port a config file writes, in the two shapes above, in the order written. */
function findPortsWrittenInConfig(configText: string): number[] {
  const ports: number[] = [];
  for (const match of configText.matchAll(vitePortPattern)) {
    ports.push(Number(match[1]));
  }
  for (const match of configText.matchAll(playwrightPortPattern)) {
    ports.push(Number(match[1]));
  }
  return ports;
}

/** Every folder under `folder` (itself included) that holds a Vite or Playwright config. */
function findFoldersWithConfigs(folder: string): string[] {
  const foldersWithConfigs: string[] = [];
  const hasAConfig = configFileNames.some((fileName) => existsSync(join(folder, fileName)));
  if (hasAConfig) {
    foldersWithConfigs.push(folder);
  }
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const isAFolderToLookIn = entry.isDirectory() && !foldersNotToLookIn.includes(entry.name);
    if (isAFolderToLookIn) {
      foldersWithConfigs.push(...findFoldersWithConfigs(join(folder, entry.name)));
    }
  }
  return foldersWithConfigs;
}

/**
 * The ports of every package under apps/ and packages/, each port once per package:
 * a graphic writes its preview port in both configs, and that is one package's port.
 */
function readPortsOfEveryPackage(): PortsOfOnePackage[] {
  const packageFolders = [
    ...findFoldersWithConfigs(join(repoRootFolder, 'apps')),
    ...findFoldersWithConfigs(join(repoRootFolder, 'packages')),
  ];
  const portsOfEveryPackage: PortsOfOnePackage[] = [];
  for (const packageFolder of packageFolders) {
    const ports = new Set<number>();
    for (const fileName of configFileNames) {
      const configPath = join(packageFolder, fileName);
      if (existsSync(configPath)) {
        for (const port of findPortsWrittenInConfig(readFileSync(configPath, 'utf8'))) {
          ports.add(port);
        }
      }
    }
    portsOfEveryPackage.push({
      packageFolder: relative(repoRootFolder, packageFolder),
      ports: [...ports],
    });
  }
  return portsOfEveryPackage;
}

/**
 * One sentence per port written by more than one package, naming the port and the
 * packages, e.g. "port 5210: packages/graphics/countdown, packages/graphics/podium".
 */
function findPortsSharedByTwoPackages(portsOfEveryPackage: PortsOfOnePackage[]): string[] {
  const packagesOfEachPort = new Map<number, string[]>();
  for (const { packageFolder, ports } of portsOfEveryPackage) {
    for (const port of ports) {
      const packagesSoFar = packagesOfEachPort.get(port) ?? [];
      packagesOfEachPort.set(port, [...packagesSoFar, packageFolder]);
    }
  }
  const sharedPorts: string[] = [];
  for (const [port, packageFolders] of packagesOfEachPort) {
    if (packageFolders.length > 1) {
      sharedPorts.push(`port ${String(port)}: ${packageFolders.join(', ')}`);
    }
  }
  return sharedPorts;
}

describe('the dev and preview ports of the repository', () => {
  it('are each written by one package only', () => {
    // Arrange: the ports of every app and graphic, read from their configs.
    const portsOfEveryPackage = readPortsOfEveryPackage();

    // Act: look for a port that two packages write.
    const sharedPorts = findPortsSharedByTwoPackages(portsOfEveryPackage);

    // Assert: there is none.
    expect(
      sharedPorts,
      'give one of the packages a free port in its vite.config.ts, playwright.config.ts and README',
    ).toEqual([]);
  });

  it('are read from the configs of the apps and the graphics', () => {
    // Arrange: nothing beyond the repository itself.

    // Act: read the ports of every package.
    const portsOfEveryPackage = readPortsOfEveryPackage();

    // Assert: the control page, the renderer and the podium are among them with their
    // ports, so the test above is not passing because it read nothing.
    const portsOf = (packageFolder: string) =>
      portsOfEveryPackage.find((found) => found.packageFolder === packageFolder)?.ports;
    expect(portsOf('apps/control'), "the control page's dev and e2e ports").toEqual([5173, 5188]);
    expect(portsOf('apps/renderer'), "the renderer's dev port").toEqual([5174]);
    expect(portsOf('packages/graphics/podium'), "the podium's dev and preview ports").toEqual([
      5202, 5203,
    ]);
  });
});

describe('findPortsWrittenInConfig', () => {
  const configs = [
    // A graphic's vite.config.ts: the dev port, then the preview port.
    {
      name: 'reads the dev and preview ports of a Vite config',
      configText: [
        'export default defineConfig({',
        "  base: './',",
        '  server: {',
        '    port: 5202,',
        '    strictPort: true,',
        '  },',
        '  preview: {',
        '    port: 5203,',
        '    strictPort: true,',
        '  },',
        '});',
      ].join('\n'),
      expectedPorts: [5202, 5203],
    },
    // A graphic's playwright.config.ts: the preview port, moved by the offset.
    {
      name: 'reads the preview port of a Playwright config',
      configText: 'const previewPort = 5203 + portOffsetOfTheBrowserTests;',
      expectedPorts: [5203],
    },
    // The control page's playwright.config.ts wraps it in String().
    {
      name: 'reads a port written inside String()',
      configText: 'const controlPagePort = String(5188 + portOffsetOfTheBrowserTests);',
      expectedPorts: [5188],
    },
    // The apps' vite.config.ts also read the server's PORT from .env, which is the
    // server's port, not this page's, and must not count as one.
    {
      name: "leaves out the server's PORT read from .env",
      configText: [
        "const serverPort = rootEnvironment.PORT ?? '3000';",
        'export default defineConfig({ server: { port: 5173, strictPort: true } });',
      ].join('\n'),
      expectedPorts: [5173],
    },
  ];

  it.each(configs)('$name', ({ configText, expectedPorts }) => {
    // Arrange: the config text of this row (in the table above).

    // Act: read its ports.
    const ports = findPortsWrittenInConfig(configText);

    // Assert: exactly the row's ports.
    expect(ports, 'the ports the config writes').toEqual(expectedPorts);
  });
});

describe('findPortsSharedByTwoPackages', () => {
  it('names the clash of PR #27 and PR #28 with both packages', () => {
    // Arrange: the countdown and the podium as they were on main before BAJAOVRLAY-50.
    const portsOfEveryPackage = [
      { packageFolder: 'packages/graphics/countdown', ports: [5210, 5211] },
      { packageFolder: 'packages/graphics/podium', ports: [5210, 5211] },
      { packageFolder: 'packages/graphics/bracket', ports: [5220, 5221] },
    ];

    // Act: look for shared ports.
    const sharedPorts = findPortsSharedByTwoPackages(portsOfEveryPackage);

    // Assert: both ports named, each with the two packages; the bracket is not named.
    expect(sharedPorts, 'each shared port with the packages that write it').toEqual([
      'port 5210: packages/graphics/countdown, packages/graphics/podium',
      'port 5211: packages/graphics/countdown, packages/graphics/podium',
    ]);
  });

  it('finds nothing when every package has ports of its own', () => {
    // Arrange: the countdown and the podium on the ports BAJAOVRLAY-50 gave them.
    const portsOfEveryPackage = [
      { packageFolder: 'packages/graphics/countdown', ports: [5210, 5211] },
      { packageFolder: 'packages/graphics/podium', ports: [5202, 5203] },
    ];

    // Act: look for shared ports.
    const sharedPorts = findPortsSharedByTwoPackages(portsOfEveryPackage);

    // Assert: none.
    expect(sharedPorts, 'no port is written by two packages').toEqual([]);
  });
});
