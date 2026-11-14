import { parentPort } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
globalThis.onmessage = null;
globalThis.postMessage = data => parentPort.postMessage(data);
globalThis.fetch = async url => {
  const bytes = await readFile(url);
  return new Response(bytes, { headers: { 'Content-Type': String(url).endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream' } });
};
await import('../site/worker.js');
parentPort.on('message', data => globalThis.onmessage({ data }));
