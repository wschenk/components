import { CONFIG } from "./config.ts";
import { RegistryItem, Registry } from "./interfaces.ts";
import { FileSystemManager } from "./file_system_manager.ts";
import { join } from "https://deno.land/std/path/mod.ts";

export class RegistryItemManager {
  private readonly fileSystem: FileSystemManager;
  private readonly registryDir: string;

  constructor(fileSystem: FileSystemManager, registryDir: string) {
    this.fileSystem = fileSystem;
    this.registryDir = registryDir;
  }

  async getRegistryItem(componentName: string): Promise<RegistryItem> {
    const registryPath = this.fileSystem.joinPath(
      this.registryDir,
      CONFIG.PATHS.REGISTRY_SUBDIR,
      componentName
    );
    const registryItemPath = this.fileSystem.joinPath(
      registryPath,
      CONFIG.PATHS.ITEM_JSON
    );

    try {
      const content = await this.fileSystem.readTextFile(registryItemPath);
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

  async updateRegistryItem(
    componentName: string,
    updates: Partial<RegistryItem>
  ): Promise<void> {
    const registryPath = this.fileSystem.joinPath(
      this.registryDir,
      CONFIG.PATHS.REGISTRY_SUBDIR,
      componentName
    );
    const registryItemPath = this.fileSystem.joinPath(
      registryPath,
      CONFIG.PATHS.ITEM_JSON
    );

    const currentItem = await this.getRegistryItem(componentName);
    const updatedItem = this.mergeRegistryItems(currentItem, updates);

    await this.fileSystem.writeTextFile(
      registryItemPath,
      JSON.stringify(updatedItem, null, 2)
    );
    console.log(`Updated registry item: ${registryItemPath}`);
  }

  mergeRegistryItems(
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

  async generateRegistryJson(): Promise<void> {
    const registryBase = this.fileSystem.joinPath(
      this.registryDir,
      CONFIG.PATHS.REGISTRY_SUBDIR
    );
    const registryJsonPath = this.fileSystem.joinPath(
      this.registryDir,
      CONFIG.PATHS.REGISTRY_JSON
    );

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

      await this.fileSystem.writeTextFile(
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
