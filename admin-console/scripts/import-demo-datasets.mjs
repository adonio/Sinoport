import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

const adminRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoRoot = resolve(adminRoot, '..');

function parseArgs(argv) {
  const flags = {
    local: true,
    remote: false,
    env: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--remote') {
      flags.remote = true;
      flags.local = false;
    }
    if (arg === '--local') {
      flags.local = true;
      flags.remote = false;
    }
    if (arg === '--env') {
      flags.env = argv[index + 1] || null;
      index += 1;
    }
  }

  return flags;
}

function isSerializableDataset(value) {
  if (typeof value === 'function' || typeof value === 'undefined') return false;

  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

function inferRowCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  if (value === null) return 0;
  return 1;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildDemoDatasetKey(sourceModule, exportName) {
  return `${sourceModule}.${exportName}`;
}

async function runCommand(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
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

async function loadDatasets() {
  const vite = await createServer({
    configFile: join(adminRoot, 'vite.config.mjs'),
    root: adminRoot,
    logLevel: 'error',
    appType: 'custom',
    server: {
      middlewareMode: true,
      hmr: false,
      watch: null
    }
  });

  try {
    const modules = [
      { source: 'sinoport', values: await vite.ssrLoadModule('/src/data/sinoport.js') },
      { source: 'sinoport-adapters', values: await vite.ssrLoadModule('/src/data/sinoport-adapters.js') }
    ];

    const datasets = [];
    for (const moduleEntry of modules) {
      for (const [exportName, value] of Object.entries(moduleEntry.values)) {
        if (!isSerializableDataset(value)) continue;

        datasets.push({
          datasetKey: buildDemoDatasetKey(moduleEntry.source, exportName),
          sourceModule: moduleEntry.source,
          exportName,
          payloadKind: Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value,
          rowCount: inferRowCount(value),
          payloadJson: JSON.stringify(value)
        });
      }
    }

    datasets.sort((left, right) => left.datasetKey.localeCompare(right.datasetKey));
    return datasets;
  } finally {
    await vite.close();
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const datasets = await loadDatasets();
  const tempDir = mkdtempSync(join(tmpdir(), 'sinoport-demo-datasets-'));
  const sqlFile = join(tempDir, 'import-demo-datasets.sql');
  const now = new Date().toISOString();
  const databaseName =
    flags.remote && flags.env
      ? `sinoport-api-${flags.env}`
      : 'sinoport-api-local';

  const statements = [
    'DELETE FROM demo_datasets;'
  ];

  for (const item of datasets) {
    statements.push(
      `INSERT INTO demo_datasets (
        dataset_key,
        source_module,
        export_name,
        payload_kind,
        row_count,
        payload_json,
        created_at,
        updated_at
      ) VALUES (
        ${sqlString(item.datasetKey)},
        ${sqlString(item.sourceModule)},
        ${sqlString(item.exportName)},
        ${sqlString(item.payloadKind)},
        ${item.rowCount},
        ${sqlString(item.payloadJson)},
        ${sqlString(now)},
        ${sqlString(now)}
      );`
    );
  }

  writeFileSync(sqlFile, statements.join('\n'));

  const args = [
    'wrangler',
    'd1',
    'execute',
    databaseName
  ];

  if (flags.remote) {
    args.push('--remote');
  } else {
    args.push('--local');
  }

  args.push('--config', 'apps/api-worker/wrangler.jsonc');

  if (flags.env) {
    args.push('--env', flags.env);
  }

  args.push('--file', sqlFile);

  const output = await runCommand('npx', args, repoRoot);
  rmSync(tempDir, { recursive: true, force: true });

  console.log(`Imported ${datasets.length} datasets into ${databaseName}`);
  console.log(output.trim());
}

main().catch((error) => {
  console.error(`import-demo-datasets failed: ${error.message}`);
  process.exitCode = 1;
});
