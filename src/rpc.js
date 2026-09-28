import { NODE_URL } from './config.js';

let requestId = 0;
export async function rpc(method, params, signal) {
  const response = await fetch(NODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
    signal,
  });
  if (!response.ok) throw new Error(`Node returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || 'Node RPC error');
  if (!payload.result) throw new Error('The node returned no result');
  return payload.result;
}

export async function getAllPages(method, signal) {
  const list = [];
  const pageSize = 100;
  for (let page = 0; page < 100; page++) {
    const result = await rpc(method, [page, pageSize], signal);
    if (!Array.isArray(result.list) || !Number.isInteger(result.count)) throw new Error('Unexpected node response');
    list.push(...result.list);
    if (list.length >= result.count) return list;
    if (result.list.length === 0) throw new Error('The node returned an incomplete page');
  }
  throw new Error('The node returned too many pages');
}
