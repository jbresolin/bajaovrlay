# Testing style

Every test file in this repository is written so that someone who has never read a test
before can follow it without an IDE. Pull requests are reviewed by reading their tests,
so a test that does not explain itself is an unfinished test.

This page explains each convention in a few lines and then shows one complete test file,
the `/health` test of `apps/server`. That file is the template: every other test file
copies its shape. The real file lives at `apps/server/src/core/http/healthRoute.test.ts`
and must stay identical to the copy below.

## The conventions

**1. A plain-language header.** Every test file opens with a comment in three parts:
what this module is for, what these tests prove, and what they deliberately do not
cover. The last part matters as much as the first two: it tells the reviewer where the
gaps are on purpose, so they do not have to guess.

**2. Sentence-style test names.** A test name is a sentence about behaviour, readable
on its own in the test report: `it('keeps the stale snapshot when the poll fails')`,
never `it('works')` or `it('test 3')`. Group sentences with `describe` blocks named
after the thing being exercised (`describe('GET /health')`).

**3. Arrange, act, assert.** Each test has three blocks separated by blank lines, and
each block starts with a one-line comment in everyday words:

- `// Arrange: ...` what is being set up,
- `// Act: ...` the one thing being done,
- `// Assert: ...` what is being checked.

Write these comments even when they feel obvious. Assume the reader has never seen a
test before.

**4. Realistic data.** Test data reads like the real thing: `team 42, "Baja UFPR"`,
version `0.3.1`, the address `/api/v1/placar-inexistente`. Never `foo`, `bar`, `x1` or
`test123`. Realistic data lets a reader check the expectation against their own
knowledge of the domain.

**5. Assertions state the expectation.** Every `expect` carries a message saying what
must be true, in words:
`expect(response.status, 'the health check must answer 200 OK').toBe(200)`. When a test
fails, the message is the first line the reader sees, so it must explain the rule that
was broken, not repeat the values.

**6. Named factories, no shared mutable state.** When several tests need the same
setup, write a small function named for what it builds
(`createServerAppForHealthTests`) and call it inside each test. Every test builds its
own objects; nothing is created in `beforeEach` and mutated across tests. Constants that
never change (like the version string below) may be shared.

**7. Table-driven scenarios, when there are several of the same shape.** Each row has a
name that reads as a sentence and a comment saying why that row exists:

```ts
const lapTimeScenarios = [
  // The common case: a normal lap well under two minutes.
  { name: 'formats a 1:42 lap', lapTimeMs: 102_000, expected: '1:42' },
  // A lap at exactly one hour must not lose the hour digit.
  { name: 'keeps the hour on a one-hour lap', lapTimeMs: 3_600_000, expected: '1:00:00' },
];

it.each(lapTimeScenarios)('$name', ({ lapTimeMs, expected }) => {
  // ...arrange, act, assert as usual
});
```

**8. Flaky tests are bugs.** A test that sometimes fails is quarantined visibly with
`it.skip`, a comment saying why, and a ticket number. It is never deleted to get a green
build.

## Where tests live

- Unit and integration tests sit next to the code they test, named `<file>.test.ts`
  (or `.test.tsx` for React components). Vitest runs them with `pnpm test`.
- Browser tests (Playwright) live in an `e2e/` folder of the package, named
  `<subject>.e2e.ts`, and run with `pnpm test:e2e`.

## The complete example

This is `apps/server/src/core/http/healthRoute.test.ts`, exactly as it is in the
repository.

```ts
/**
 * Health check and unknown addresses (apps/server)
 *
 * What this module is for:
 *   `GET /health` is how the operator, OBS and CI ask "is the server up, and which
 *   version is running?". Any address the server does not know must still answer in
 *   JSON, so the control page can always read the reply instead of choking on HTML.
 *
 * What these tests prove:
 *   - `/health` answers 200 with a body that passes the shared HealthResponseSchema
 *     and carries the version the server was started with.
 *   - An unknown address answers 404 with a JSON error whose message is in pt-BR.
 *
 * What these tests deliberately do not cover:
 *   - The real network socket: the app is called in memory through `app.request()`,
 *     which runs the same routes and middleware without opening a port.
 *   - Serving the built control page and renderer. That only happens when their
 *     `dist` folders exist, and is checked by hand with `pnpm build` then `pnpm start`.
 */
import { HealthResponseSchema } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { createLogger } from '../logger/createLogger.js';
import { createServerApp } from './createServerApp.js';

const runningServerVersion = '0.3.1';

/** Builds the server app as production does, but silent and without static folders. */
function createServerAppForHealthTests() {
  return createServerApp({
    logger: createLogger({ level: 'silent' }),
    version: runningServerVersion,
  });
}

describe('GET /health', () => {
  it('answers 200 with a body that passes the shared schema and names the version', async () => {
    // Arrange: a server app that believes it is version 0.3.1.
    const app = createServerAppForHealthTests();

    // Act: ask for /health, exactly as the control page does.
    const response = await app.request('/health');
    const body: unknown = await response.json();

    // Assert: the answer is 200 OK and the body is what the shared schema describes.
    const parsedBody = HealthResponseSchema.safeParse(body);
    expect(response.status, 'the health check must answer 200 OK').toBe(200);
    expect(parsedBody.success, 'the body must pass the shared HealthResponseSchema').toBe(true);
    expect(body, 'the body must say the server is ok and name its version').toEqual({
      ok: true,
      version: '0.3.1',
    });
  });
});

describe('an address the server does not know', () => {
  it('answers 404 with a JSON error in pt-BR, not an HTML page', async () => {
    // Arrange: the same server app, with no route for scoreboards.
    const app = createServerAppForHealthTests();

    // Act: ask for an address that does not exist, as a mistyped URL would.
    const response = await app.request('/api/v1/placar-inexistente');
    const body: unknown = await response.json();

    // Assert: the answer is a 404 in JSON with a stable code and a pt-BR message.
    expect(response.status, 'an unknown address must answer 404 Not Found').toBe(404);
    expect(
      response.headers.get('content-type'),
      'the 404 must be JSON so every client can parse it',
    ).toContain('application/json');
    expect(body, 'the error must carry a stable code and a message in pt-BR').toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Endereço não encontrado no servidor.',
      },
    });
  });
});
```
