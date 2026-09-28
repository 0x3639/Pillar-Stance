import fs from 'node:fs/promises';
import { buildEvaluationContext } from '../src/evaluation-context.js';

const site = JSON.parse(await fs.readFile(new URL('../src/data/site.json', import.meta.url)));
await fs.rm(new URL('../public/briefs/', import.meta.url), { recursive: true, force: true });
await fs.writeFile(new URL('../public/evaluate-the-work.txt', import.meta.url), buildEvaluationContext(site));
console.log('Generated public evaluation context.');
