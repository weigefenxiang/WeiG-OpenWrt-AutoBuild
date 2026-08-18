#!/usr/bin/env node
// Extend the canonical project gate without duplicating its implementation.
await import('./check-all-core.mjs');
await import('./test-compatibility-recommendation.mjs');
