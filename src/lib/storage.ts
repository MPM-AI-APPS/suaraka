import { promises as fs } from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./.storage");

function resolveSafe(rel: string) {
  const full = path.resolve(ROOT, rel);
  if (!full.startsWith(ROOT)) throw new Error("Path traversal detected");
  return full;
}

export async function ensureRoot() {
  await fs.mkdir(ROOT, { recursive: true });
}

export async function saveBuffer(relPath: string, data: Buffer) {
  await ensureRoot();
  const full = resolveSafe(relPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return relPath;
}

export async function readBuffer(relPath: string) {
  return fs.readFile(resolveSafe(relPath));
}

export async function exists(relPath: string) {
  try {
    await fs.access(resolveSafe(relPath));
    return true;
  } catch {
    return false;
  }
}

export async function remove(relPath: string) {
  try {
    await fs.rm(resolveSafe(relPath), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export function storageRoot() {
  return ROOT;
}
