// registry_manager.ts
import { parse } from "https://deno.land/std/flags/mod.ts";
import {
  join,
  basename,
  dirname,
  relative,
  resolve,
} from "https://deno.land/std/path/mod.ts";
import { ensureDir, exists, copy } from "https://deno.land/std/fs/mod.ts";

// Centralized configuration
const CONFIG = {
  // Path constants
  PATHS: {
    DEFAULT_SOURCE_DIR: Deno.cwd(),
    DEFAULT_REGISTRY_DIR: "../registry",
    REGISTRY_SUBDIR: "registry",
    REGISTRY_JSON: "registry.json",
    ITEM_JSON: "registry-item.json",
  },

  // Schema URLs
  SCHEMAS: {
    REGISTRY: "https://ui.shadcn.com/schema/registry.json",
    REGISTRY_ITEM: "https://ui.shadcn.com/schema/registry-item.json",
  },

  // Default configurations
  DEFAULTS: {
    REGISTRY: {
      name: "shadcn-custom",
      homepage: "https://ui.shadcn.com",
      items: [],
    },

    REGISTRY_ITEM: {
      type: "registry:block",
      categories: [],
      registryDependencies: [],
      dependencies: [],
      files: [],
      meta: {},
      cssVars: {
        light: {},
        dark: {},
      },
    },
  },

  // File type mappings
  FILE_TYPES: {
    LIB_PATH: "lib/",
    HOOK_IDENTIFIER: "/hook",
    UI_IDENTIFIER: "/ui/",
    PAGE_FILENAME: "page.tsx",
    PAGE_DIRNAME: "page",
    DEFAULT_TYPE: "registry:file",
    TYPE_MAPPINGS: {
      LIB: "registry:lib",
      HOOK: "registry:hook",
      UI: "registry:ui",
      PAGE: "registry:page",
      COMPONENT: "registry:component",
      FILE: "registry:file",
    },
  },

  // CLI Configuration
  CLI: {
    STRING_ARGS: [
      "source",
      "registry",
      "title",
      "description",
      "type",
      "author",
      "docs",
    ],
    BOOLEAN_ARGS: ["overwrite"],
    DEFAULT_ARGS: {
      source: Deno.cwd(),
      registry: "../registry",
      overwrite: false,
    },
    USAGE_TEXT: `
Usage:
  deno run registry_manager.ts add <component-name> [--source=<dir>] [--registry=<dir>] <files...>
  deno run registry_manager.ts addRegDep <component-name> [--registry=<dir>] <dependencies...>
  deno run registry_manager.ts addDep <component-name> [--registry=<dir>] <npm-packages...>
  deno run registry_manager.ts update <component-name> [--title=<title>] [--description=<desc>] [--type=<type>] [--author=<author>] [--docs=<docs>]
  deno run registry_manager.ts rebuildRegistry [--registry=<dir>]
  deno run registry_manager.ts rebuildUI

Options:
  --source      Source directory (default: current directory)
  --registry    Registry directory (default: ../registry)
  --title       Component title
  --description Component description
  --type        Component type (e.g., registry:block)
  --author      Component author
  --docs        Component documentation
    `.trim(),
  },
};

// Type definitions
interface RegistryFile {
  path: string;
  type: string;
  target?: string;
}

interface RegistryMeta {
  [key: string]: unknown;
}

interface RegistryItem {
  $schema: string;
  name: string;
  type: string;
  title: string;
  description: string;
  author?: string;
  categories?: string[];
  meta?: RegistryMeta;
  files: RegistryFile[];
  registryDependencies?: string[];
  dependencies?: string[];
  cssVars?: {
    light?: Record<string, string>;
    dark?: Record<string, string>;
  };
  docs?: string;
}

interface Registry {
  $schema: string;
  name: string;
  homepage: string;
  items: RegistryItem[];
}

class RegistryManager {
  private readonly sourceDir: string;
  private readonly registryDir: string;

  constructor(sourceDir: string, registryDir: string) {
    this.sourceDir = resolve(sourceDir);
    this.registryDir = resolve(registryDir);
  }

  // File System Operations
  private async *getFiles(dir: string): AsyncGenerator<string> {
    for await (const entry of Deno.readDir(dir)) {
      const path = join(dir, entry.name);
      if (entry.isDirectory) {
        yield* this.getFiles(path);
      } else {
        yield path;
      }
    }
  }

  private async readTextFile(path: string): Promise<string> {
    try {
      return await Deno.readTextFile(path);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Error reading file ${path}: ${message}`);
    }
  }

  private async writeTextFile(path: string, content: string): Promise<void> {
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

  // File Type Determination
  private determineFileType(filePath: string): string {
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

  // Dependency Analysis
  private async extractUIComponentDeps(filePath: string): Promise<string[]> {
    try {
      const content = await this.readTextFile(filePath);
      const importRegex = /@\/components\/ui\/([^"']+)/g;
      const matches = [...content.matchAll(importRegex)];

      return [...new Set(matches.map((match) => match[1].split("/")[0]))];
    } catch (error) {
      console.error(`Error extracting dependencies from ${filePath}:`, error);
      return [];
    }
  }

  // Registry Item Operations
  private async getRegistryItem(componentName: string): Promise<RegistryItem> {
    const registryPath = join(
      this.registryDir,
      CONFIG.PATHS.REGISTRY_SUBDIR,
      componentName
    );
    const registryItemPath = join(registryPath, CONFIG.PATHS.ITEM_JSON);

    try {
      const content = await this.readTextFile(registryItemPath);
      return {
        ...CONFIG.DEFAULTS.REGISTRY_ITEM,
        ...JSON.parse(content),
        $schema: CONFIG.SCHEMAS.REGISTRY_ITEM,
      };
    } catch {
      return {
        ...CONFIG.DEFAULTS.REGISTRY_ITEM,
        $schema: CONFIG.SCHEMAS.REGISTRY_ITEM,
        name: componentName,
        title: componentName.charAt(0).toUpperCase() + componentName.slice(1),
        description: `${componentName} component`,
        files: [],
      } as RegistryItem;
    }
  }

  public async updateRegistryItem(
    componentName: string,
    updates: Partial<RegistryItem>
  ): Promise<void> {
    const registryPath = join(
      this.registryDir,
      CONFIG.PATHS.REGISTRY_SUBDIR,
      componentName
    );
    const registryItemPath = join(registryPath, CONFIG.PATHS.ITEM_JSON);

    const currentItem = await this.getRegistryItem(componentName);
    const updatedItem = this.mergeRegistryItems(currentItem, updates);

    await this.writeTextFile(
      registryItemPath,
      JSON.stringify(updatedItem, null, 2)
    );
    console.log(`Updated registry item: ${registryItemPath}`);
  }

  private mergeRegistryItems(
    current: RegistryItem,
    updates: Partial<RegistryItem>
  ): RegistryItem {
    return {
      ...current,
      ...updates,
      registryDependencies: [
        ...new Set([
          ...(current.registryDependencies || []),
          ...(updates.registryDependencies || []),
        ]),
      ].sort(),
      dependencies: [
        ...new Set([
          ...(current.dependencies || []),
          ...(updates.dependencies || []),
        ]),
      ].sort(),
      categories: [
        ...new Set([
          ...(current.categories || []),
          ...(updates.categories || []),
        ]),
      ],
      meta: {
        ...(current.meta || {}),
        ...(updates.meta || {}),
      },
      cssVars: {
        light: {
          ...(current.cssVars?.light || {}),
          ...(updates.cssVars?.light || {}),
        },
        dark: {
          ...(current.cssVars?.dark || {}),
          ...(updates.cssVars?.dark || {}),
        },
      },
    };
  }

  // Main Operations
  public async addToRegistry(
    sourcePaths: string[],
    componentName: string
  ): Promise<void> {
    const sourceFiles: string[] = [];
    const allUIDeps = new Set<string>();

    // Collect all source files
    for (const sourcePath of sourcePaths) {
      const stat = await Deno.stat(sourcePath);
      if (stat.isDirectory) {
        for await (const file of this.getFiles(sourcePath)) {
          sourceFiles.push(file);
        }
      } else {
        sourceFiles.push(sourcePath);
      }
    }

    if (sourceFiles.length === 0) {
      throw new Error("No files found to process");
    }

    // Create registry directory structure
    const registryPath = join(
      this.registryDir,
      CONFIG.PATHS.REGISTRY_SUBDIR,
      componentName
    );
    await ensureDir(registryPath);

    // Process each file
    for (const sourceFile of sourceFiles) {
      const absoluteSourceFile = resolve(sourceFile);
      const sourceFileName = basename(sourceFile);

      // For components and hooks, place directly in registry item directory
      // For other types, maintain original directory structure
      let destPath: string;
      let registryFilePath: string;

      if (
        this.determineFileType(sourceFile) ===
          CONFIG.FILE_TYPES.TYPE_MAPPINGS.COMPONENT ||
        this.determineFileType(sourceFile) ===
          CONFIG.FILE_TYPES.TYPE_MAPPINGS.HOOK
      ) {
        destPath = join(registryPath, sourceFileName);
        registryFilePath = join(
          CONFIG.PATHS.REGISTRY_SUBDIR,
          componentName,
          sourceFileName
        );
      } else {
        const relPath = relative(this.sourceDir, absoluteSourceFile);
        destPath = join(registryPath, relPath);
        registryFilePath = join(
          CONFIG.PATHS.REGISTRY_SUBDIR,
          componentName,
          relPath
        );
      }

      // Ensure destination directory exists and copy file
      await ensureDir(dirname(destPath));
      await copy(absoluteSourceFile, destPath, { overwrite: true });

      // Create registry file entry
      const fileType = this.determineFileType(sourceFile);

      const currentFileType = this.determineFileType(sourceFile);
      const fileEntry: RegistryFile = {
        path: registryFilePath,
        type: currentFileType,
      };

      if (
        currentFileType === CONFIG.FILE_TYPES.TYPE_MAPPINGS.PAGE ||
        currentFileType === CONFIG.FILE_TYPES.TYPE_MAPPINGS.FILE
      ) {
        const relPath = relative(this.sourceDir, absoluteSourceFile);
        fileEntry.target = relPath;
      }

      // Extract UI dependencies if it's a TSX file
      if (sourceFile.endsWith(".tsx")) {
        const deps = await this.extractUIComponentDeps(absoluteSourceFile);
        deps.forEach((dep) => allUIDeps.add(dep));
      }

      // Update registry item
      const registryItem = await this.getRegistryItem(componentName);
      const existingFileIndex = registryItem.files.findIndex(
        (f) => f.path === registryFilePath
      );

      if (existingFileIndex >= 0) {
        registryItem.files[existingFileIndex] = fileEntry;
      } else {
        registryItem.files.push(fileEntry);
      }

      await this.updateRegistryItem(componentName, {
        files: registryItem.files,
        registryDependencies: [...allUIDeps],
      });
    }

    // Generate consolidated registry.json
    await this.generateRegistryJson();
  }

  public async generateRegistryJson(): Promise<void> {
    const registryBase = join(this.registryDir, CONFIG.PATHS.REGISTRY_SUBDIR);
    const registryJsonPath = join(this.registryDir, CONFIG.PATHS.REGISTRY_JSON);

    const items: RegistryItem[] = [];

    try {
      for await (const entry of Deno.readDir(registryBase)) {
        if (entry.isDirectory) {
          const item = await this.getRegistryItem(entry.name);
          items.push(item);
        }
      }

      items.sort((a, b) => a.name.localeCompare(b.name));

      const registry: Registry = {
        $schema: CONFIG.SCHEMAS.REGISTRY,
        ...CONFIG.DEFAULTS.REGISTRY,
        items,
      };

      await this.writeTextFile(
        registryJsonPath,
        JSON.stringify(registry, null, 2)
      );
      console.log(
        `Generated ${CONFIG.PATHS.REGISTRY_JSON} with ${items.length} items`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Error generating registry.json: ${message}`);
    }
  }
}

// CLI Implementation
async function main() {
  const args = parse(Deno.args, {
    string: CONFIG.CLI.STRING_ARGS,
    boolean: CONFIG.CLI.BOOLEAN_ARGS,
    default: CONFIG.CLI.DEFAULT_ARGS,
  });

  const [command, ...restArgs] = args._;

  if (!command) {
    console.error(CONFIG.CLI.USAGE_TEXT);
    Deno.exit(1);
  }

  const manager = new RegistryManager(args.source, args.registry);

  try {
    switch (command) {
      case "add": {
        const [componentName, ...files] = restArgs.map(String);
        await manager.addToRegistry(files, componentName as string);
        break;
      }
      case "addRegDep": {
        const [componentName, ...deps] = restArgs.map(String);
        await manager.updateRegistryItem(componentName as string, {
          registryDependencies: deps,
        });
        break;
      }
      case "addDep": {
        const [componentName, ...deps] = restArgs.map(String);
        await manager.updateRegistryItem(componentName as string, {
          dependencies: deps,
        });
        break;
      }
      case "update": {
        const [componentName] = restArgs.map(String);
        const updates: Partial<RegistryItem> = {};

        if (args.title) updates.title = args.title;
        if (args.description) updates.description = args.description;
        if (args.type) updates.type = args.type;
        if (args.author) updates.author = args.author;
        if (args.docs) updates.docs = args.docs;

        await manager.updateRegistryItem(componentName as string, updates);
        break;
      }
      case "rebuildRegistry": {
        await manager.generateRegistryJson();
        break;
      }
      case "rebuildUI": {
        const process = Deno.run({
          cmd: ["pnpx", "shadcn", "build"],
        });
        const status = await process.status();

        if (!status.success) {
          console.error("Failed to rebuild UI components.");
          Deno.exit(1);
        }
        break;
      }
      default: {
        console.error(`Unknown command: ${command}`);
        console.error(CONFIG.CLI.USAGE_TEXT);
        Deno.exit(1);
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
