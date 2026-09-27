import fs from 'node:fs/promises';
import { DEFAULT_OWNERS } from '../src/config.js';
import { loadTracking } from '../src/rpc.js';

const snapshot = await loadTracking(DEFAULT_OWNERS, AbortSignal.timeout(30_000));
await fs.writeFile(new URL('../src/data/snapshot.json', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Saved ${snapshot.projects.length} proposals and ${snapshot.activePillars} active Pillars at ${snapshot.fetchedAt}.`);
