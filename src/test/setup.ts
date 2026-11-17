import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Pages are lazily loaded, so a page first appears in a task after the initial
// render or navigation. When many test files run in parallel that can exceed
// the 1 s default of `findBy`/`waitFor`; allow longer before failing. The
// queries and assertions themselves are unchanged.
configure({ asyncUtilTimeout: 5000 });
