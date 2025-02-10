import { CONFIG } from "./config.ts";

export function determineFileType(filePath: string): string {
  const { FILE_TYPES } = CONFIG;
  const fileName = basename(filePath);
  const dirName = basename(dirname(filePath));

  if (filePath.startsWith(FILE_TYPES.LIB_PATH))
    return FILE_TYPES.TYPE_MAPPINGS.LIB;
  if (filePath.includes(FILE_TYPES.HOOK_IDENTIFIER))
    return FILE_TYPES.TYPE_MAPPINGS.HOOK;
  if (filePath.includes(FILE_TYPES.UI_IDENTIFIER))
    return FILE_TYPES.TYPE_MAPPINGS.UI;

  if (
    fileName === FILE_TYPES.PAGE_FILENAME ||
    dirName === FILE_TYPES.PAGE_DIRNAME
  ) {
    return FILE_TYPES.TYPE_MAPPINGS.PAGE;
  }

  if (fileName.endsWith(".tsx")) return FILE_TYPES.TYPE_MAPPINGS.COMPONENT;

  return FILE_TYPES.DEFAULT_TYPE;
}

export async function extractUIComponentDeps(
  filePath: string,
  fileSystem: FileSystemManager
): Promise<string[]> {
  try {
    const content = await fileSystem.readTextFile(filePath);
    const importRegex = /@\/components\/ui\/([^"']+)/g;
    const matches = [...content.matchAll(importRegex)];

    return [...new Set(matches.map((match) => match[1].split("/")[0]))];
  } catch (error) {
    console.error(`Error extracting dependencies from ${filePath}:`, error);
    return [];
  }
}

import { basename, dirname } from "https://deno.land/std/path/mod.ts";
import { FileSystemManager } from "./file_system_manager.ts";
