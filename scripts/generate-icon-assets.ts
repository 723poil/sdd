import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectoryPath = dirname(fileURLToPath(import.meta.url));
const projectRootPath = dirname(scriptDirectoryPath);
const iconDirectoryPath = join(projectRootPath, 'build', 'icon');
const previewPngPath = join(iconDirectoryPath, 'sdd-icon.png');
const iconsetDirectoryPath = join(iconDirectoryPath, 'sdd.iconset');
const targetIcnsPath = join(iconDirectoryPath, 'sdd.icns');
const renderIconScriptPath = join(projectRootPath, 'scripts', 'render-icon.swift');
const writeIcnsScriptPath = join(projectRootPath, 'scripts', 'write-icns.swift');

type IconsetEntry = {
  fileName: string;
  pixelSize: number;
};

const ICONSET_ENTRIES: IconsetEntry[] = [
  { fileName: 'icon_16x16.png', pixelSize: 16 },
  { fileName: 'icon_16x16@2x.png', pixelSize: 32 },
  { fileName: 'icon_32x32.png', pixelSize: 32 },
  { fileName: 'icon_32x32@2x.png', pixelSize: 64 },
  { fileName: 'icon_128x128.png', pixelSize: 128 },
  { fileName: 'icon_128x128@2x.png', pixelSize: 256 },
  { fileName: 'icon_256x256.png', pixelSize: 256 },
  { fileName: 'icon_256x256@2x.png', pixelSize: 512 },
  { fileName: 'icon_512x512.png', pixelSize: 512 },
  { fileName: 'icon_512x512@2x.png', pixelSize: 1024 },
];

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv = {}): void {
  execFileSync(command, args, {
    env: {
      ...process.env,
      ...env,
    },
    stdio: 'ignore',
  });
}

async function ensureSourceSvg(): Promise<void> {
  return Promise.resolve();
}

async function rebuildIconsetDirectory(): Promise<void> {
  await rm(iconsetDirectoryPath, { recursive: true, force: true });
  await rm(previewPngPath, { force: true });
  await mkdir(iconsetDirectoryPath, { recursive: true });
}

function renderPreviewPng(): void {
  runCommand(
    'swift',
    [renderIconScriptPath, previewPngPath],
    {
      CLANG_MODULE_CACHE_PATH: '/tmp/sdd-swift-module-cache',
      SWIFT_MODULECACHE_PATH: '/tmp/sdd-swift-module-cache',
    },
  );
  runCommand('sips', ['-z', '1024', '1024', previewPngPath, '--out', previewPngPath]);
}

function renderIconsetEntries(): void {
  for (const entry of ICONSET_ENTRIES) {
    runCommand('sips', [
      '-z',
      `${entry.pixelSize}`,
      `${entry.pixelSize}`,
      previewPngPath,
      '--out',
      join(iconsetDirectoryPath, entry.fileName),
    ]);
  }
}

function buildIcns(): void {
  runCommand(
    'swift',
    [writeIcnsScriptPath, previewPngPath, targetIcnsPath],
    {
      CLANG_MODULE_CACHE_PATH: '/tmp/sdd-swift-module-cache',
      SWIFT_MODULECACHE_PATH: '/tmp/sdd-swift-module-cache',
    },
  );
}

async function cleanup(): Promise<void> {
  await rm(iconsetDirectoryPath, { recursive: true, force: true });
}

async function generateIconAssets(): Promise<void> {
  await ensureSourceSvg();
  await rebuildIconsetDirectory();
  renderPreviewPng();
  renderIconsetEntries();
  buildIcns();
  await cleanup();
}

generateIconAssets().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '아이콘 생성에 실패했습니다.';
  console.error(message);
  process.exitCode = 1;
});
