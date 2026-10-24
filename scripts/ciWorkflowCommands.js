// Reads the shell commands of a GitHub Actions workflow file as text, for
// verifyMatchesCi.test.ts, which checks that `pnpm verify` runs what CI runs. No YAML
// library: the workflow writes its commands in three shapes only, all read here.

/**
 * Every `run:` command of a workflow, in file order, with runs of spaces made one. The
 * three shapes:
 *   run: pnpm lint                    one line
 *   run: >-                           folded: the lines below, joined with spaces
 *   run: |                            literal: the lines below, kept as lines
 * The lines of a block are those indented deeper than the `run:` key.
 * @param {string} workflowText
 * @returns {string[]}
 */
export function readRunCommandsOfWorkflow(workflowText) {
  const lines = workflowText.split('\n');
  /** @type {string[]} */
  const commands = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? '';
    const match = /^(\s*)(- )?run: ?(.*)$/.exec(line);
    if (match === null) {
      continue;
    }
    const indentBeforeTheDash = match[1] ?? '';
    const dash = match[2] ?? '';
    const keyIndent = indentBeforeTheDash.length + dash.length;
    const value = (match[3] ?? '').trim();
    const isFolded = value === '>-' || value === '>';
    const isLiteral = value === '|' || value === '|-';
    if (!isFolded && !isLiteral) {
      commands.push(collapseSpaces(value));
      continue;
    }
    /** @type {string[]} */
    const blockLines = [];
    while (lineIndex + 1 < lines.length) {
      const nextLine = lines[lineIndex + 1] ?? '';
      const nextIndent = nextLine.length - nextLine.trimStart().length;
      const isInsideTheBlock = nextLine.trim() === '' || nextIndent > keyIndent;
      if (!isInsideTheBlock) {
        break;
      }
      blockLines.push(nextLine.trim());
      lineIndex += 1;
    }
    const nonEmptyLines = blockLines.filter((blockLine) => blockLine !== '');
    const separator = isFolded ? ' ' : '\n';
    commands.push(nonEmptyLines.map((blockLine) => collapseSpaces(blockLine)).join(separator));
  }
  return commands;
}

/**
 * Makes every run of spaces one space, so a command compares the same however it is
 * indented or wrapped.
 * @param {string} text
 * @returns {string}
 */
function collapseSpaces(text) {
  return text.replace(/ +/g, ' ').trim();
}

/**
 * Every `working-directory:` the workflow sets (a step's, or a job's under `defaults`), as
 * written. A command run in another folder is not the command `pnpm verify` runs from the
 * root, though it reads the same, so verifyMatchesCi.test.ts allows none.
 * @param {string} workflowText
 * @returns {string[]}
 */
export function findWorkingDirectoriesOfWorkflow(workflowText) {
  /** @type {string[]} */
  const workingDirectories = [];
  for (const line of workflowText.split('\n')) {
    const match = /^\s*(- )?working-directory: ?(.*)$/.exec(line);
    if (match !== null) {
      workingDirectories.push((match[2] ?? '').trim());
    }
  }
  return workingDirectories;
}
