import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function writeTextAtomically(filePath: string, content: string): Promise<void> {
  const directoryPath = dirname(filePath);
  const tempFilePath = join(
    directoryPath,
    `.${Date.now().toString()}-${Math.random().toString(16).slice(2)}.tmp`,
  );

  await mkdir(directoryPath, { recursive: true });
  await writeFile(tempFilePath, content, 'utf8');
  await rename(tempFilePath, filePath);
}

export async function writeJsonAtomically(filePath: string, value: unknown): Promise<void> {
  await writeTextAtomically(filePath, JSON.stringify(value, null, 2));
}
