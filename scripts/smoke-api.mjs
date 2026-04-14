import { once } from 'node:events';
import { spawn } from 'node:child_process';

const PORT = 8791;
const INSPECTOR_PORT = 9231;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function waitForReady(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for wrangler dev to start.'));
    }, 30_000);

    const onData = (chunk) => {
      const text = chunk.toString();
      if (text.includes('Ready on')) {
        clearTimeout(timeout);
        child.stdout.off('data', onData);
        resolve();
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

async function jsonFetch(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const json = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    json
  };
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

async function main() {
  const worker = spawn(
    'npx',
    ['wrangler', 'dev', '--config', 'apps/api-worker/wrangler.jsonc', '--port', String(PORT), '--inspector-port', String(INSPECTOR_PORT)],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  worker.stdout.pipe(process.stdout);
  worker.stderr.pipe(process.stderr);

  try {
    await waitForReady(worker);

    const login = await jsonFetch('/api/v1/mobile/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator: 'Smoke Test Operator',
        employeeId: 'PDA-001',
        stationCode: 'MME',
        roleKey: 'receiver',
        language: 'zh'
      })
    });

    if (!login.ok) {
      throw new Error(`mobile/login failed with status ${login.status}`);
    }

    const token = login.json?.data?.token;

    if (!token) {
      throw new Error('mobile/login did not return a token');
    }

    const mobileTasks = await jsonFetch('/api/v1/mobile/tasks', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!mobileTasks.ok || !Array.isArray(mobileTasks.json?.items)) {
      throw new Error('mobile/tasks did not return a valid task list');
    }

    const documents = await jsonFetch('/api/v1/station/documents', {
      headers: {
        Authorization: 'Bearer demo-token',
        'X-Debug-Roles': 'document_desk',
        'X-Debug-User-Id': 'demo-docdesk',
        'X-Debug-Station-Scope': 'MME'
      }
    });

    if (!documents.ok || !Array.isArray(documents.json?.items)) {
      throw new Error('station/documents did not return a valid document list');
    }

    console.log('\nSmoke summary');
    console.log(`- mobile/login: ${login.status}`);
    console.log(`- mobile/tasks count: ${mobileTasks.json.items.length}`);
    console.log(`- station/documents count: ${documents.json.items.length}`);
  } finally {
    await stopWorker(worker);
  }
}

main().catch((error) => {
  console.error(`Smoke API failed: ${error.message}`);
  process.exitCode = 1;
});
