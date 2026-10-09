// Runs before every control-page test file (see vitest.config.ts).
// Adds DOM matchers such as `toBeInTheDocument()` to `expect`.
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only removes rendered pages automatically when Vitest globals are on.
// They are off in this repository, so each test's page is removed here; otherwise the
// next test would find two pages and two buttons.
afterEach(() => {
  cleanup();
});
