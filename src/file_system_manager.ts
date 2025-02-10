import {
  join,
  basename,
  dirname,
  relative,
  resolve,
} from "https://deno.land/std/path/mod.ts";
import { ensureDir, copy } from "https://deno.land/std/fs/mod.ts";

export class FileSystemManager {
  private readonly sourceDir: string;
  private readonly registryDir: string;

  constructor(sourceDir: string, registryDir: string) {
    this.sourceDir = resolve(sourceDir);
    this.registryDir = resolve(registryDir);
  }

  // File System Operations
  async *getFiles(dir: string): AsyncGenerator<string> {
    for await (const entry of Deno.readDir(dir)) {
      const path = join(dir, entry.name);
      if (entry.isDirectory) {
        yield* this.getFiles(path);
      } else {
        yield path;
      }
    }
  }

  async readTextFile(path: string): Promise<string> {
    try {
      return await Deno.readTextFile(path);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Error reading file ${path}: ${message}`);
    }
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    try {
      await Deno.writeTextFile(
        path,
        JSON.stringify(JSON.parse(content), null, 2)
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Error writing file ${path}: ${message}`);
    }
  }

  async ensureDir(dirPath: string): Promise<void> {
    await ensureDir(dirPath);
  }

  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    await copy(sourcePath, destPath, { overwrite: true });
  }

  resolvePath(path: string): string {
    return resolve(path);
  }

  relativePath(from: string, to: string): string {
    return relative(from, to);
  }

  joinPath(...paths: string[]): string {
    return join(...paths);
  }

  dirname(path: string): string {
    return dirname(path);
  }

  basename(path: string): string {
    return basename(path);
  }
}
