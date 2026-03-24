import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { APP_DISPLAY_NAME } from '../src/shared/app/app-display-name.ts';

type DevAppMetadata = {
  electronVersion: string;
  executableName: string;
  iconModifiedAt: number;
};

const require = createRequire(import.meta.url);

const scriptDirectoryPath = dirname(fileURLToPath(import.meta.url));
const projectRootPath = dirname(scriptDirectoryPath);
const electronPackagePath = require.resolve('electron/package.json');
const electronModulePath = dirname(electronPackagePath);
const sourceAppPath = join(electronModulePath, 'dist', 'Electron.app');
const devAppDirectoryPath = join(projectRootPath, 'out', 'dev-app');
const targetAppPath = join(devAppDirectoryPath, `${APP_DISPLAY_NAME}.app`);
const targetInfoPlistPath = join(targetAppPath, 'Contents', 'Info.plist');
const sourcePreviewIconPath = join(projectRootPath, 'build', 'icon', 'sdd-icon.png');
const sourceIconPath = join(projectRootPath, 'build', 'icon', 'sdd.icns');
const targetElectronIconPath = join(targetAppPath, 'Contents', 'Resources', 'electron.icns');
const targetAppIconPath = join(targetAppPath, 'Contents', 'Resources', 'sdd.icns');
const metadataFilePath = join(devAppDirectoryPath, 'metadata.json');

async function readElectronVersion(): Promise<string> {
  const packageJson = await readFile(electronPackagePath, 'utf8');
  const parsed = JSON.parse(packageJson) as { version?: string };

  if (!parsed.version) {
    throw new Error('electron package version을 확인할 수 없습니다.');
  }

  return parsed.version;
}

async function readMetadata(): Promise<DevAppMetadata | null> {
  try {
    const raw = await readFile(metadataFilePath, 'utf8');
    return JSON.parse(raw) as DevAppMetadata;
  } catch {
    return null;
  }
}

async function hasExistingDevApp(): Promise<boolean> {
  try {
    await stat(targetAppPath);
    return true;
  } catch {
    return false;
  }
}

async function readIconModifiedAt(): Promise<number> {
  const fileStat = await stat(sourcePreviewIconPath);
  return fileStat.mtimeMs;
}

function upsertPlistStringKey(key: string, value: string): void {
  try {
    execFileSync('plutil', ['-replace', key, '-string', value, targetInfoPlistPath]);
  } catch {
    execFileSync('plutil', ['-insert', key, '-string', value, targetInfoPlistPath]);
  }
}

async function copyFreshAppBundle(): Promise<void> {
  await mkdir(devAppDirectoryPath, { recursive: true });
  await rm(targetAppPath, { recursive: true, force: true });
  execFileSync('ditto', ['--clone', sourceAppPath, targetAppPath]);
}

async function renameExecutableIfNeeded(): Promise<void> {
  const defaultExecutablePath = join(targetAppPath, 'Contents', 'MacOS', 'Electron');
  const targetExecutablePath = join(targetAppPath, 'Contents', 'MacOS', APP_DISPLAY_NAME);

  try {
    await stat(targetExecutablePath);
    return;
  } catch {
    await rename(defaultExecutablePath, targetExecutablePath);
  }
}

function updateMainBundleMetadata(): void {
  upsertPlistStringKey('CFBundleDisplayName', APP_DISPLAY_NAME);
  upsertPlistStringKey('CFBundleName', APP_DISPLAY_NAME);
  upsertPlistStringKey('CFBundleExecutable', APP_DISPLAY_NAME);
  upsertPlistStringKey('CFBundleIdentifier', 'com.sdd.desktop.dev');
  upsertPlistStringKey('CFBundleIconFile', 'electron.icns');
}

function adHocSignAppBundle(): void {
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', targetAppPath], {
    stdio: 'ignore',
  });
}

function clearBundleExtendedAttributes(): void {
  execFileSync('xattr', ['-cr', targetAppPath], {
    stdio: 'ignore',
  });
}

async function installAppIcon(): Promise<void> {
  await copyFile(sourceIconPath, targetElectronIconPath);
  await copyFile(sourceIconPath, targetAppIconPath);
}

function refreshAppBundleTimestamp(): void {
  execFileSync('touch', [targetAppPath]);
}

async function writeMetadata(metadata: DevAppMetadata): Promise<void> {
  await writeFile(metadataFilePath, JSON.stringify(metadata, null, 2));
}

function getTargetExecutablePath(): string {
  return join(targetAppPath, 'Contents', 'MacOS', APP_DISPLAY_NAME);
}

export async function prepareDevMacApp(): Promise<string> {
  if (process.platform !== 'darwin') {
    throw new Error('macOS 전용 dev app 준비 스크립트입니다.');
  }

  const electronVersion = await readElectronVersion();
  const iconModifiedAt = await readIconModifiedAt();
  const metadata = await readMetadata();
  const hasAppBundle = await hasExistingDevApp();
  const shouldRefresh =
    !hasAppBundle ||
    metadata?.electronVersion !== electronVersion ||
    metadata?.executableName !== APP_DISPLAY_NAME ||
    metadata?.iconModifiedAt !== iconModifiedAt;

  if (!shouldRefresh) {
    return getTargetExecutablePath();
  }

  await copyFreshAppBundle();
  await renameExecutableIfNeeded();
  await installAppIcon();
  updateMainBundleMetadata();
  refreshAppBundleTimestamp();
  clearBundleExtendedAttributes();
  adHocSignAppBundle();
  await writeMetadata({
    electronVersion,
    executableName: APP_DISPLAY_NAME,
    iconModifiedAt,
  });

  return getTargetExecutablePath();
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  prepareDevMacApp()
    .then((executablePath) => {
      console.log(executablePath);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'dev app 준비에 실패했습니다.';
      console.error(message);
      process.exitCode = 1;
    });
}
