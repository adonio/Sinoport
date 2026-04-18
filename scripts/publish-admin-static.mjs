import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const appDist = join(repoRoot, 'admin-console', 'dist');
const assetSource = join(appDist, 'assets');
const outputRoot = resolve(process.env.PUBLISH_STATIC_OUTPUT_ROOT || join(repoRoot, '.generated', 'admin-static'));
const assetTarget = join(outputRoot, 'admin-assets');
const distIndex = join(appDist, 'index.html');

const routes = [
  'login',
  'platform/operations',
  'platform/stations',
  'platform/stations/capabilities',
  'platform/stations/teams',
  'platform/stations/zones',
  'platform/stations/devices',
  'platform/network',
  'platform/network/lanes',
  'platform/network/scenarios',
  'platform/rules',
  'platform/master-data',
  'platform/master-data/sync',
  'platform/master-data/jobs',
  'platform/master-data/relationships',
  'platform/audit',
  'platform/audit/events',
  'platform/audit/trust',
  'platform/reports',
  'platform/reports/stations',
  'station/dashboard',
  'station/inbound',
  'station/inbound/flights',
  'station/inbound/flights/new',
  'station/inbound/flights/SE803',
  'station/inbound/waybills',
  'station/inbound/mobile',
  'station/outbound',
  'station/outbound/flights',
  'station/outbound/waybills',
  'station/shipments',
  'station/shipments/in-436-10358585',
  'station/shipments/out-436-10357583',
  'station/documents',
  'station/documents/noa',
  'station/documents/pod',
  'station/tasks',
  'station/resources',
  'station/resources/teams',
  'station/resources/zones',
  'station/resources/devices',
  'station/resources/vehicles',
  'station/exceptions',
  'station/exceptions/EXP-0408-001',
  'station/reports',
  'station/reports/shift',
  'mobile/login',
  'mobile/select',
  'mobile/pre-warehouse',
  'mobile/pre-warehouse/URC-COL-001',
  'mobile/headhaul',
  'mobile/headhaul/TRIP-URC-001',
  'mobile/outbound',
  'mobile/outbound/SE913',
  'mobile/outbound/SE913/receipt',
  'mobile/outbound/SE913/pmc',
  'mobile/export-ramp',
  'mobile/export-ramp/SE913',
  'mobile/runtime',
  'mobile/runtime/SE913',
  'mobile/destination-ramp',
  'mobile/destination-ramp/SE803',
  'mobile/inbound',
  'mobile/inbound/SE803',
  'mobile/inbound/SE803/breakdown',
  'mobile/inbound/SE803/pallet',
  'mobile/inbound/SE803/loading',
  'mobile/tailhaul',
  'mobile/tailhaul/TAIL-001',
  'mobile/delivery',
  'mobile/delivery/DLV-001'
];

function getFaviconName() {
  return readdirSync(assetTarget).find((name) => name.startsWith('favicon-') && name.endsWith('.svg'));
}

function routeIndexPath(route) {
  return join(outputRoot, route, 'index.html');
}

function assetPrefixFor(route) {
  const depth = route.split('/').length;
  return `${'../'.repeat(depth)}admin-assets`;
}

function buildRouteHtml(template, route, faviconName) {
  const assetPrefix = assetPrefixFor(route);

  return template
    .replaceAll('/assets/', `${assetPrefix}/`)
    .replaceAll('/logo192.png', `${assetPrefix}/${faviconName}`);
}

function main() {
  if (!existsSync(appDist) || !existsSync(distIndex) || !existsSync(assetSource)) {
    throw new Error('admin-console build output not found. Run `npm --prefix admin-console run build` first.');
  }

  rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(outputRoot, { recursive: true });
  rmSync(assetTarget, { recursive: true, force: true });
  mkdirSync(assetTarget, { recursive: true });
  cpSync(assetSource, assetTarget, { recursive: true });

  const faviconName = getFaviconName();
  if (!faviconName) {
    throw new Error('Could not find built favicon asset.');
  }

  const template = readFileSync(distIndex, 'utf8');

  for (const route of routes) {
    const outputPath = routeIndexPath(route);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, buildRouteHtml(template, route, faviconName));
  }
}

main();
