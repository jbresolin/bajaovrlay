// The rules of scripts/noRealLookingSecrets.test.ts (BAJAOVRLAY-60): which written values
// look like a real credential. GitGuardian scans every PR for "Generic High Entropy
// Secret" and flagged test tokens on PRs #34 and #43, none of them real. These rules are
// stricter than GitGuardian on purpose: a value they let through reads as fake to a person
// too. TypeScript, not a plain-Node script: only that test imports it.

/** The five shapes of a value that could be taken for a real credential. */
export type SecretLookingRuleName =
  | 'hex of 16 or more characters'
  | 'base64 of 20 or more characters'
  | 'value of a credential name'
  | 'password in a URL'
  | 'quoted value next to a password word';

/** One value a rule caught, on its 1-based line. */
export type SecretLookingValue = {
  lineNumber: number;
  ruleName: SecretLookingRuleName;
  value: string;
};

// A run of hexadecimal digits not glued to other letters or digits, so the end of
// "d200-mesa-9f3c…" counts but no word that happens to hold "deadbeef" does.
const hexRunPattern = /(?<![0-9A-Za-z])[0-9a-fA-F]{16,}(?![0-9A-Za-z])/g;

// A run of base64 digits with its padding. The slash, a base64 digit too, is left out:
// with it every source path ("apps/server/src/…") would be one long run.
const base64RunPattern = /(?<![0-9A-Za-z+])[0-9A-Za-z+]{20,}={0,2}(?![0-9A-Za-z+=])/g;

// What tells random base64 from a name made of words and numbers, as code names things
// ("buildLibraryWithTeams42And7", "the30thCompetitionSponsors"), is checked in two plain
// steps below. Not one regular expression describing a name on purpose: that one
// backtracked for minutes on a long base64 run.
const smallLetterAfterDigitPattern = /[0-9][a-z]/;

// An embedded file (`data:…;base64,<payload>`, Inkscape's colour profile in
// docs/brand/logo-baja.svg) is a file's bytes, never a credential.
const embeddedFilePayloadPattern = /;base64,[A-Za-z0-9+/=]+/g;

// A name that says it holds a credential: token, password (and its pt-BR "senha"),
// secret, salt, challenge, bearer, auth, and a key that is an API, secret, private,
// access or signing key. A bare "key" is left out: in this repository it is a keyboard
// key, a React key or a field key, never a credential.
const credentialNamePattern =
  /(token|password|passwd|senha|secret|salt|challenge|bearer|auth|(api|secret|private|access|signing)_?key)/i;

// `name = 'value'`, `name: "value"`, `NAME=value` (.env, shell), `NAME: value` (YAML).
// The name may be quoted (`"token": "…"` in JSON).
const nameAndValuePattern =
  /([A-Za-z_][A-Za-z0-9_]*)['"]?\s*[:=]\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`|([^\s'"`,;]+))/g;

// The characters a credential written without quotes is made of. Anything else (a
// bracket, a parenthesis) means the value is code, such as `token: readToken(header)`.
const unquotedCredentialPattern = /^[A-Za-z0-9._~+/=-]+$/;

// `scheme://<user>:<password>@host`.
const passwordInUrlPattern = /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s/:@'"`]+:([^\s/@'"`]+)@/g;

// A password named in prose, a comment or a doc: senha, password, passwd or pass, as a
// whole word. GitGuardian's "Generic Password" reads a quoted value next to one of them
// as a password, with no `name =` before it (incident on this guard's own first commit).
const passwordWordPattern = /\b(senhas?|passwords?|passwd|pass)\b/gi;

// A value in quotes of any kind, with no space inside: a sentence in quotes is not one.
const quotedValuePattern = /'([^'\s]+)'|"([^"\s]+)"|`([^`\s]+)`/g;

// How far from the password word, in characters, a quoted value counts as "next to" it:
// enough for "a senha do OBS é `…`", short enough that a value later on the line is not.
const charactersNextToAPasswordWord = 20;

// Words that make a value read as fake to anyone, GitGuardian included.
const fakeWordPattern = /test|fake|example|placeholder/i;

// A placeholder the reader replaces: `<openssl rand -hex 16>`, `<senha do OBS>`.
const placeholderPattern = /^<[^<>]+>$/;

/** Whether a value reads as fake: it says so in a word, or it is a `<…>` placeholder. */
export function isObviouslyFakeValue(value: string): boolean {
  return fakeWordPattern.test(value) || placeholderPattern.test(value);
}

/** Whether a hex run is a credential shape: digits and letters both (all digits is a number). */
function isMixedHexRun(run: string): boolean {
  const hasDigit = /[0-9]/.test(run);
  const hasLetter = /[a-fA-F]/.test(run);
  return hasDigit && hasLetter;
}

/** The kind of one character: small letter, capital letter, digit or other. */
function readCharacterKind(character: string): 'small' | 'capital' | 'digit' | 'other' {
  if (/[a-z]/.test(character)) {
    return 'small';
  }
  if (/[A-Z]/.test(character)) {
    return 'capital';
  }
  if (/[0-9]/.test(character)) {
    return 'digit';
  }
  return 'other';
}

/** How many times the kind of character changes from one character to the next. */
function countCharacterKindChanges(run: string): number {
  let kindChanges = 0;
  for (let index = 1; index < run.length; index += 1) {
    const kindBefore = readCharacterKind(run.charAt(index - 1));
    const kindHere = readCharacterKind(run.charAt(index));
    if (kindBefore !== kindHere) {
      kindChanges += 1;
    }
  }
  return kindChanges;
}

/**
 * Whether a base64 run is a credential shape: three kinds of character, a small letter
 * right after a digit ("Y29tcG…", which a name like "askTheStateAsTheD200" never has), and
 * a change of kind at least every other character on average. A name changes kind about
 * once a word ("keepsTheAnswerOutside2xx": 8 changes in 24); random base64 more often
 * than that (the base64 of "companion:senha": 11 in 20).
 */
function isRandomLookingBase64Run(run: string): boolean {
  const withoutPadding = run.replace(/=+$/, '');
  const hasUpperCase = /[A-Z]/.test(withoutPadding);
  const hasLowerCase = /[a-z]/.test(withoutPadding);
  const hasDigit = /[0-9]/.test(withoutPadding);
  if (!hasUpperCase || !hasLowerCase || !hasDigit) {
    return false;
  }
  // A run that is hexadecimal is the hex rule's to report, once.
  const isHexadecimal = /^[0-9a-fA-F]+$/.test(withoutPadding);
  if (isHexadecimal) {
    return false;
  }
  const hasSmallLetterAfterDigit = smallLetterAfterDigitPattern.test(withoutPadding);
  const changesKindOften = countCharacterKindChanges(withoutPadding) * 2 >= withoutPadding.length;
  return hasSmallLetterAfterDigit && changesKindOften;
}

/**
 * Whether a value given to a credential name could be a credential: six or more
 * characters, letters and digits both (as people make them up: a word and a year), no space.
 * Left out: whatever is clearly something else, such as an interpolation, a CSS custom
 * property, a path, an environment variable's name, a version or `options.apiTokens`.
 */
function couldValueBeACredential(value: string, isQuoted: boolean): boolean {
  if (value.length < 6) {
    return false;
  }
  if (!isQuoted && !unquotedCredentialPattern.test(value)) {
    return false;
  }
  const hasLetter = /[A-Za-z]/.test(value);
  const hasDigit = /[0-9]/.test(value);
  const hasSpace = /\s/.test(value);
  const isInterpolation = value.includes('${');
  const isCssCustomProperty = value.startsWith('--') || value.startsWith('var(');
  const isPath = value.startsWith('/') || value.startsWith('.');
  const isEnvironmentVariableName = /^[A-Z][A-Z0-9_]*$/.test(value);
  return (
    hasLetter &&
    hasDigit &&
    !hasSpace &&
    !isInterpolation &&
    !isCssCustomProperty &&
    !isPath &&
    !isEnvironmentVariableName
  );
}

/**
 * Whether a quoted value, from its first to its last character on the line, sits within
 * a few characters of a password word, before or after it.
 */
function isNextToAPasswordWord(lineText: string, valueStart: number, valueEnd: number): boolean {
  for (const wordMatch of lineText.matchAll(passwordWordPattern)) {
    const wordStart = wordMatch.index;
    const wordEnd = wordStart + wordMatch[0].length;
    const charactersFromWordToValue = valueStart - wordEnd;
    const charactersFromValueToWord = wordStart - valueEnd;
    const isShortlyAfterTheWord =
      charactersFromWordToValue >= 0 && charactersFromWordToValue <= charactersNextToAPasswordWord;
    const isShortlyBeforeTheWord =
      charactersFromValueToWord >= 0 && charactersFromValueToWord <= charactersNextToAPasswordWord;
    if (isShortlyAfterTheWord || isShortlyBeforeTheWord) {
      return true;
    }
  }
  return false;
}

/** The values of one line that look like credentials and do not read as fake. */
export function findSecretLookingValuesOnLine(
  writtenLineText: string,
  lineNumber: number,
): SecretLookingValue[] {
  const lineText = writtenLineText.replace(embeddedFilePayloadPattern, ';base64,');
  const found: SecretLookingValue[] = [];

  for (const match of lineText.matchAll(hexRunPattern)) {
    const run = match[0];
    if (isMixedHexRun(run) && !isObviouslyFakeValue(run)) {
      found.push({ lineNumber, ruleName: 'hex of 16 or more characters', value: run });
    }
  }

  for (const match of lineText.matchAll(base64RunPattern)) {
    const run = match[0];
    if (isRandomLookingBase64Run(run) && !isObviouslyFakeValue(run)) {
      found.push({ lineNumber, ruleName: 'base64 of 20 or more characters', value: run });
    }
  }

  for (const match of lineText.matchAll(nameAndValuePattern)) {
    const name = match[1] ?? '';
    const quotedValue = match[2] ?? match[3] ?? match[4];
    const isQuoted = quotedValue !== undefined;
    const value = quotedValue ?? match[5] ?? '';
    const hasCredentialName = credentialNamePattern.test(name);
    if (
      hasCredentialName &&
      couldValueBeACredential(value, isQuoted) &&
      !isObviouslyFakeValue(value)
    ) {
      found.push({ lineNumber, ruleName: 'value of a credential name', value });
    }
  }

  for (const match of lineText.matchAll(passwordInUrlPattern)) {
    const password = match[1] ?? '';
    const isInterpolation = password.includes('${');
    if (!isInterpolation && !isObviouslyFakeValue(password)) {
      found.push({ lineNumber, ruleName: 'password in a URL', value: password });
    }
  }

  for (const match of lineText.matchAll(quotedValuePattern)) {
    const value = match[1] ?? match[2] ?? match[3] ?? '';
    const valueStart = match.index;
    const valueEnd = valueStart + match[0].length;
    // `password: '…'` is the credential-name rule's to report, once.
    const isAlreadyFound = found.some((foundValue) => foundValue.value === value);
    if (
      !isAlreadyFound &&
      isNextToAPasswordWord(lineText, valueStart, valueEnd) &&
      couldValueBeACredential(value, true) &&
      !isObviouslyFakeValue(value)
    ) {
      found.push({ lineNumber, ruleName: 'quoted value next to a password word', value });
    }
  }

  return found;
}

/** The values of a whole file's text that look like credentials and do not read as fake. */
export function findSecretLookingValuesInText(fileText: string): SecretLookingValue[] {
  const lines = fileText.split('\n');
  const found: SecretLookingValue[] = [];
  lines.forEach((lineText, index) => {
    found.push(...findSecretLookingValuesOnLine(lineText, index + 1));
  });
  return found;
}
