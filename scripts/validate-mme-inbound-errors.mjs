import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const PORT = 8792;
const INSPECTOR_PORT = 9232;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const INVALID_FIXTURE_URL = new URL('./fixtures/inbound-bundles/mme-inbound-bundle-missing-awb.json', import.meta.url);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadInvalidBundleFixture() {
  return JSON.parse(readFileSync(INVALID_FIXTURE_URL, 'utf8'));
}

async function waitForReady(child) {
  return new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for wrangler dev.')), 30_000);
    const onData = (chunk) => {
      const text = chunk.toString();
      if (text.includes('Ready on')) {
        clearTimeout(timeout);
        child.stdout.off('data', onData);
        child.stderr.off('data', onData);
        resolvePromise();
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`wrangler dev exited early with code ${code}`));
    });
  });
}

async function stopWorker(worker) {
  worker.kill('SIGINT');

  try {
    await Promise.race([
      once(worker, 'exit'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for wrangler dev to exit.')), 10_000))
    ]);
  } catch {
    worker.kill('SIGKILL');
  }
}

async function runCommand(command, args) {
  const child = spawn(command, args, {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  const [code] = await once(child, 'exit');

  if (code !== 0) {
    throw new Error(output || `${command} ${args.join(' ')} failed`);
  }

  return output;
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const json = await response.json();

  return { ok: response.ok, status: response.status, json };
}

async function main() {
  await runCommand('npm', ['run', 'db:migrate:local', '--workspace', '@sinoport/api-worker']);

  const worker = spawn(
    'npx',
    ['wrangler', 'dev', '--config', 'apps/api-worker/wrangler.jsonc', '--port', String(PORT), '--inspector-port', String(INSPECTOR_PORT)],
    { cwd: ROOT_DIR, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  worker.stdout.pipe(process.stdout);
  worker.stderr.pipe(process.stderr);

  try {
    await waitForReady(worker);

    const stationLogin = await jsonRequest('/api/v1/station/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'integration-web',
        roleIds: ['station_supervisor'],
        stationCode: 'MME'
      })
    });
    assert(stationLogin.ok, 'station/login failed');

    const stationToken = stationLogin.json?.data?.token;
    assert(Boolean(stationToken), 'station/login token missing');

    const invalidPayload = loadInvalidBundleFixture();
    const importResult = await jsonRequest('/api/v1/station/imports/inbound-bundle', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': invalidPayload.request_id
      },
      body: JSON.stringify(invalidPayload)
    });

    assert(importResult.status === 400, `expected 400, received ${importResult.status}`);
    assert(importResult.json?.error?.code === 'VALIDATION_ERROR', 'expected VALIDATION_ERROR for invalid inbound bundle');
    assert(/awb_no/i.test(importResult.json?.error?.message || ''), 'expected awb_no validation message');

    console.log('\nMME inbound validation summary');
    console.log(`- station/login: ${stationLogin.status}`);
    console.log(`- invalid inbound bundle: ${importResult.status}`);
    console.log(`- error code: ${importResult.json?.error?.code || '--'}`);
  } finally {
    await stopWorker(worker);
  }
}

main().catch((error) => {
  console.error(`MME inbound validation failed: ${error.message}`);
  process.exitCode = 1;
});
