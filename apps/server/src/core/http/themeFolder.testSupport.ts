// Test support: a stand-in for packages/theme in the system's temporary folder, removed
// when the test ends. It holds the three folders the server serves (ardosia/, fonts/,
// brand/) with small files of the right kinds, and the two things that must never be
// served: the motion helper's source (src/) and package.json. Server tests use it so they
// never depend on the real theme package's files.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { onTestFinished } from 'vitest';

/** The stand-in tokens file: one token is enough to tell it apart from any other file. */
export const standInTokensCss = ':root {\n  --panel-base: rgb(20 25 48 / 0.84);\n}\n';

/** The stand-in @font-face file, naming the font file beside it as the real one does. */
export const standInFontsCss =
  "@font-face {\n  font-family: 'Bebas Neue';\n  src: url('./bebas-neue/bebas-neue-latin-400-normal.woff2') format('woff2');\n}\n";

/** A few bytes starting with the woff2 magic number, standing in for the font file. */
export const standInFontFileBytes = Buffer.from('wOF2 arquivo de fonte de teste');

/** The eight bytes every PNG starts with, standing in for the logo. */
export const standInLogoBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** A line of the motion helper's source that must never reach a browser. */
/** The word the climb-out tests look for in an answer: it only exists in the secret below. */
export const themeSourceSecretWord = 'segredoDoCodigoFonte';
export const themeSourceSecret = `export const ${themeSourceSecretWord} = 'nao deve sair do servidor';`;

/**
 * Writes the stand-in theme folder and returns its absolute path. The folder is deleted
 * when the running test ends.
 */
export function createStandInThemeFolder(): string {
  const themeFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-tema-'));
  onTestFinished(() => rmSync(themeFolder, { recursive: true, force: true }));

  mkdirSync(join(themeFolder, 'ardosia'));
  mkdirSync(join(themeFolder, 'fonts', 'bebas-neue'), { recursive: true });
  mkdirSync(join(themeFolder, 'brand'));
  mkdirSync(join(themeFolder, 'src'));
  writeFileSync(join(themeFolder, 'ardosia', 'tokens.css'), standInTokensCss);
  writeFileSync(join(themeFolder, 'fonts', 'fonts.css'), standInFontsCss);
  writeFileSync(
    join(themeFolder, 'fonts', 'bebas-neue', 'bebas-neue-latin-400-normal.woff2'),
    standInFontFileBytes,
  );
  writeFileSync(join(themeFolder, 'brand', 'logo-branca.png'), standInLogoBytes);
  writeFileSync(join(themeFolder, 'src', 'readMotionTokens.ts'), themeSourceSecret);
  writeFileSync(join(themeFolder, 'package.json'), '{ "name": "@bajaovrlay/theme" }');

  return themeFolder;
}
