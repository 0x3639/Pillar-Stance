import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllPages } from '../src/rpc.js';

test('pagination loads every page rather than silently dropping older proposals', async () => {
  const original = globalThis.fetch;
  const pages = [];
  globalThis.fetch = async (_, options) => {
    const { params } = JSON.parse(options.body);
    pages.push(params[0]);
    return { ok: true, json: async () => ({ result: { count: 103, list: Array.from({ length: params[0] === 0 ? 100 : 3 }, (_, i) => i + params[0] * 100) } }) };
  };
  try { const result = await getAllPages('embedded.accelerator.getAll'); assert.equal(result.length, 103); assert.deepEqual(pages, [0, 1]); }
  finally { globalThis.fetch = original; }
});

test('RPC errors and incomplete pagination fail instead of becoming a successful empty state', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ error: { message: 'Unavailable' } }) });
    await assert.rejects(getAllPages('embedded.accelerator.getAll'), /Unavailable/);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: { count: 1, list: [] } }) });
    await assert.rejects(getAllPages('embedded.accelerator.getAll'), /incomplete page/);
  } finally { globalThis.fetch = original; }
});
