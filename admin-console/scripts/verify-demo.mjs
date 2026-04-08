import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(process.cwd(), '..');
const appRoot = process.cwd();

const requiredDocs = [
  'docs/sinoport-os-upgrade-task-plan.md',
  'docs/sinoport-os-front-demo-iteration-1-qa-checklist.md',
  'docs/sinoport-os-front-demo-iteration-1-demo-script.md',
  'docs/sinoport-os-front-demo-iteration-2-qa-checklist.md',
  'docs/sinoport-os-front-demo-iteration-2-demo-script.md',
  'docs/sinoport-os-front-demo-release-checklist.md',
  'docs/sinoport-os-front-demo-smoke-report.md',
  'docs/sinoport-os-front-demo-coverage-matrix.md'
];

const requiredMainRoutes = [
  'operations',
  'stations/capabilities',
  'network/scenarios',
  'master-data/relationships',
  'audit/trust',
  'reports/stations',
  'resources/vehicles',
  'documents/noa',
  'documents/pod',
  'exceptions/:exceptionId',
  'reports/shift'
];

const requiredMobileRoutes = [
  'pre-warehouse',
  'pre-warehouse/:batchId',
  'headhaul',
  'headhaul/:tripId',
  'runtime',
  'runtime/:flightNo',
  'export-ramp',
  'export-ramp/:flightNo',
  'destination-ramp',
  'destination-ramp/:flightNo',
  'tailhaul',
  'tailhaul/:tripId',
  'delivery',
  'delivery/:deliveryId'
];

const requiredContractStrings = [
  'gateEvaluationRows',
  'documentVersionRows',
  'mobileRoleOptions',
  'roleTaskViews'
];

const requiredMobileSessionStrings = ['getMobileRoleKey', 'getMobileOpsStorageKey', 'getMobileFlowStorageKey'];
const requiredMobileOpsStrings = ['syncState', 'queue', 'recordMobileAction', 'syncMobileQueue'];
const requiredMobileLoginStrings = ['Demo 角色', 'roleKey', 'roleLabel'];
const requiredNodeShellStrings = ['当前角色', 'roleAllowed', 'filterMobileActionsByRole'];

function runStep(label, cmd, args, cwd) {
  process.stdout.write(`\n[verify-demo] ${label}\n`);
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: false
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function assertPaths(label, paths) {
  const missing = paths.filter((file) => !existsSync(resolve(projectRoot, file)));
  if (missing.length) {
    throw new Error(`${label} missing:\n${missing.join('\n')}`);
  }
  process.stdout.write(`[verify-demo] ${label} ok (${paths.length})\n`);
}

function assertRouteStrings(filePath, label, requiredStrings) {
  const content = readFileSync(resolve(appRoot, filePath), 'utf8');
  const missing = requiredStrings.filter((value) => !content.includes(value));
  if (missing.length) {
    throw new Error(`${label} missing route strings:\n${missing.join('\n')}`);
  }
  process.stdout.write(`[verify-demo] ${label} ok (${requiredStrings.length})\n`);
}

function assertFileStrings(filePath, label, requiredStrings) {
  const content = readFileSync(resolve(appRoot, filePath), 'utf8');
  const missing = requiredStrings.filter((value) => !content.includes(value));
  if (missing.length) {
    throw new Error(`${label} missing strings in ${filePath}:\n${missing.join('\n')}`);
  }
  process.stdout.write(`[verify-demo] ${label} ok (${requiredStrings.length})\n`);
}

try {
  runStep('eslint', 'npx', ['eslint', 'src/**/*.{js,jsx,ts,tsx}', '--quiet'], appRoot);
  runStep('build', 'npm', ['run', 'build'], appRoot);
  assertPaths('required docs', requiredDocs);
  assertRouteStrings('src/routes/MainRoutes.jsx', 'main routes', requiredMainRoutes);
  assertRouteStrings('src/routes/MobileRoutes.jsx', 'mobile routes', requiredMobileRoutes);
  assertFileStrings('src/data/sinoport-adapters.js', 'shared contract', requiredContractStrings);
  assertFileStrings('src/utils/mobile/session.js', 'mobile session', requiredMobileSessionStrings);
  assertFileStrings('src/utils/mobile/task-ops.js', 'mobile ops', requiredMobileOpsStrings);
  assertFileStrings('src/pages/mobile/login.jsx', 'mobile login', requiredMobileLoginStrings);
  assertFileStrings('src/pages/mobile/node-shared.jsx', 'mobile role shell', requiredNodeShellStrings);
  process.stdout.write('\n[verify-demo] all checks passed\n');
} catch (error) {
  console.error(`\n[verify-demo] failed: ${error.message}`);
  process.exit(1);
}
