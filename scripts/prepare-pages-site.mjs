import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const outputRoot = join(repoRoot, 'site-dist');
const generatedAdminRoot = resolve(process.env.PUBLISH_STATIC_OUTPUT_ROOT || join(repoRoot, '.generated', 'admin-static'));

const rootFiles = ['CNAME', 'index.html', 'about.html', 'network.html', 'scenarios.html', 'sinoport-os.html', 'solutions.html'];
const rootDirs = ['assets', 'en'];
const generatedDirs = ['login', 'platform', 'station', 'mobile', 'admin-assets'];

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

  if (!existsSync(generatedAdminRoot)) {
    throw new Error('generated admin static output not found. Run `node scripts/publish-admin-static.mjs` first.');
  }

  for (const entry of generatedDirs) {
    const source = join(generatedAdminRoot, entry);
    if (!existsSync(source)) {
      continue;
    }

    cpSync(source, join(outputRoot, entry), { recursive: true });
  }

  // The admin app still references some imported assets from absolute `/assets/...` URLs at runtime.
  // Mirror built admin assets into the root assets directory so custom-domain deployments resolve them.
  cpSync(join(generatedAdminRoot, 'admin-assets'), join(outputRoot, 'assets'), { recursive: true });

  writeFileSync(join(outputRoot, '.nojekyll'), '');
}

main();
