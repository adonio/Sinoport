import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const outputRoot = join(repoRoot, 'site-dist');

const rootFiles = ['index.html', 'about.html', 'network.html', 'scenarios.html', 'sinoport-os.html', 'solutions.html'];
const rootDirs = ['assets', 'en', 'platform', 'station', 'mobile', 'admin-assets'];

function copyEntry(entry) {
  const source = join(repoRoot, entry);
  const target = join(outputRoot, entry);

  if (!existsSync(source)) {
    return;
  }

  cpSync(source, target, { recursive: true });
}

function main() {
  rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(outputRoot, { recursive: true });

  rootFiles.forEach(copyEntry);
  rootDirs.forEach(copyEntry);

  writeFileSync(join(outputRoot, '.nojekyll'), '');
}

main();
