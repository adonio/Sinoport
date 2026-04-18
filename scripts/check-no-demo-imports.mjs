import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const allowedExactFiles = new Set([
  'admin-console/scripts/import-demo-datasets.mjs',
  'admin-console/scripts/verify-demo.mjs',
  'admin-console/src/data/sinoport-adapters.js',
  'scripts/check-no-demo-imports.mjs'
]);

const allowedPrefixes = ['admin-console/src/data/'];

const ignoredRootPrefixes = ['admin-assets/', 'assets/'];
const ignoredPathFragments = ['/dist/', '/build/', '/coverage/', '/admin-assets/', '/assets/'];
const trackedCodeExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);

const forbiddenModulePattern = /((?:\/src\/)?data\/sinoport-adapters(?:\.js)?|(?:\/src\/)?data\/sinoport(?:\.js)?)(?![-\w])/g;

function listTrackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  return output.split('\0').filter(Boolean);
}

function isAllowedFile(filePath) {
  return allowedExactFiles.has(filePath) || allowedPrefixes.some((prefix) => filePath.startsWith(prefix));
}

function isIgnoredFile(filePath) {
  if (ignoredRootPrefixes.some((prefix) => filePath.startsWith(prefix))) {
    return true;
  }

  return ignoredPathFragments.some((fragment) => filePath.includes(fragment));
}

function getFileMatches(filePath) {
  const content = readFileSync(resolve(repoRoot, filePath), 'utf8');
  const matches = [];

  for (const [index, line] of content.split('\n').entries()) {
    forbiddenModulePattern.lastIndex = 0;
    if (!forbiddenModulePattern.test(line)) continue;

    const snippet = line.trim();
    matches.push(`${filePath}:${index + 1}: ${snippet}`);
  }

  return matches;
}

const offenders = [];

for (const filePath of listTrackedFiles()) {
  if (!trackedCodeExtensions.has(filePath.slice(filePath.lastIndexOf('.')))) continue;
  if (isIgnoredFile(filePath)) continue;
  if (isAllowedFile(filePath)) continue;

  offenders.push(...getFileMatches(filePath));
}

if (offenders.length > 0) {
  console.error('Forbidden demo imports found:');
  for (const offender of offenders) {
    console.error(`- ${offender}`);
  }
  process.exit(1);
}
