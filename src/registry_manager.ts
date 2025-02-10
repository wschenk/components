import { CONFIG } from "./config.ts";
import { RegistryFile } from "./interfaces.ts";
import { FileSystemManager } from "./file_system_manager.ts";
import { RegistryItemManager } from "./registry_item_manager.ts";
import { determineFileType, extractUIComponentDeps } from "./utils.ts";
import { resolve } from "https://deno.land/std/path/mod.ts";
import { walk, exists } from "https://deno.land/std/fs/mod.ts";
import { crypto } from "https://deno.land/std/crypto/mod.ts";

export class RegistryManager {
  private readonly fileSystem: FileSystemManager;
  private readonly registryItemManager: RegistryItemManager;
  private readonly sourceDir: string;
  private readonly registryDir: string;

  constructor(sourceDir: string, registryDir: string) {
    this.sourceDir = resolve(sourceDir);
    this.registryDir = resolve(registryDir);
    this.fileSystem = new FileSystemManager(sourceDir, registryDir);
    this.registryItemManager = new RegistryItemManager(
      this.fileSystem,
      registryDir
    );
  }

  async addToRegistry(
    sourcePaths: string[],
    componentName: string
  ): Promise<void> {
    const sourceFiles: string[] = [];
    const allUIDeps = new Set<string>();

    // Collect all source files
    for (const sourcePath of sourcePaths) {
      const absoluteSourcePath = this.fileSystem.resolvePath(sourcePath);
      const stat = await Deno.stat(absoluteSourcePath);
      if (stat.isDirectory) {
        for await (const file of this.fileSystem.getFiles(absoluteSourcePath)) {
          sourceFiles.push(file);
        }
      } else {
        sourceFiles.push(absoluteSourcePath);
      }
    }

    if (sourceFiles.length === 0) {
      throw new Error("No files found to process");
    }

    // Create registry directories
    const registryDir = this.fileSystem.joinPath(this.sourceDir, ".registry");
    const registryPath = this.fileSystem.joinPath(
      this.registryDir,
      CONFIG.PATHS.REGISTRY_SUBDIR,
      componentName
    );
    await this.fileSystem.ensureDir(registryDir);
    await this.fileSystem.ensureDir(registryPath);

    let registryFiles: {
      name: string;
      size: number;
      hash: string;
    }[] = [];

    // Load existing registry data if it exists
    const localRegistryPath = this.fileSystem.joinPath(
      registryDir,
      `${componentName}.json`
    );

    if (await exists(localRegistryPath)) {
      try {
        const content = await this.fileSystem.readTextFile(localRegistryPath);
        registryFiles = JSON.parse(content);
      } catch (error: unknown) {
        console.error(
          `Error reading existing registry file ${localRegistryPath}:`,
          error
        );
        // If there's an error reading the file, start with an empty array
        registryFiles = [];
      }
    }

    // Process each file
    for (const sourceFile of sourceFiles) {
      const absoluteSourceFile = this.fileSystem.resolvePath(sourceFile);
      const sourceFileName = this.fileSystem.basename(sourceFile);

      let destPath: string;
      let registryFilePath: string;

      if (
        determineFileType(sourceFile) ===
          CONFIG.FILE_TYPES.TYPE_MAPPINGS.COMPONENT ||
        determineFileType(sourceFile) === CONFIG.FILE_TYPES.TYPE_MAPPINGS.HOOK
      ) {
        destPath = this.fileSystem.joinPath(registryPath, sourceFileName);
        registryFilePath = this.fileSystem.joinPath(
          CONFIG.PATHS.REGISTRY_SUBDIR,
          componentName,
          sourceFileName
        );
      } else {
        const relPath = this.fileSystem.relativePath(
          this.sourceDir,
          absoluteSourceFile
        );
        destPath = this.fileSystem.joinPath(registryPath, relPath);
        registryFilePath = this.fileSystem.joinPath(
          CONFIG.PATHS.REGISTRY_SUBDIR,
          componentName,
          relPath
        );
      }

      // Ensure destination directory exists and copy file
      await this.fileSystem.ensureDir(this.fileSystem.dirname(destPath));
      await this.fileSystem.copyFile(absoluteSourceFile, destPath);

      const fileInfo = await Deno.stat(absoluteSourceFile);
      const fileContent = await Deno.readFile(absoluteSourceFile);
      const hash = await crypto.subtle.digest("SHA-256", fileContent);
      const hashArray = Array.from(new Uint8Array(hash));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const relSourceFile = this.fileSystem.relativePath(
        this.sourceDir,
        absoluteSourceFile
      );

      // Check if the file already exists in the registry
      const existingFileIndex = registryFiles.findIndex(
        (file) => file.name === relSourceFile
      );

      if (existingFileIndex !== -1) {
        // Update existing file
        registryFiles[existingFileIndex] = {
          name: relSourceFile,
          size: fileInfo.size,
          hash: hashHex,
        };
      } else {
        // Add new file
        registryFiles.push({
          name: relSourceFile,
          size: fileInfo.size,
          hash: hashHex,
        });
      }

      // Create registry file entry
      const currentFileType = determineFileType(sourceFile);
      const fileEntry: RegistryFile = {
        path: registryFilePath,
        type: currentFileType,
      };

      if (
        currentFileType === CONFIG.FILE_TYPES.TYPE_MAPPINGS.PAGE ||
        currentFileType === CONFIG.FILE_TYPES.TYPE_MAPPINGS.FILE
      ) {
        const relPath = this.fileSystem.relativePath(
          this.sourceDir,
          absoluteSourceFile
        );
        fileEntry.target = relPath;
      }

      // Extract UI dependencies if it's a TSX file
      if (sourceFile.endsWith(".tsx")) {
        const deps = await extractUIComponentDeps(sourceFile, this.fileSystem);
        deps.forEach((dep) => allUIDeps.add(dep));
      }

      // Update registry item
      let registryItemFileIndex = -1;
      const registryItem = await this.registryItemManager.getRegistryItem(
        componentName
      );
      registryItemFileIndex = registryItem.files.findIndex(
        (f) => f.path === registryFilePath
      );

      if (existingFileIndex >= 0) {
        registryItem.files[existingFileIndex] = fileEntry;
      } else {
        registryItem.files.push(fileEntry);
      }

      await this.registryItemManager.updateRegistryItem(componentName, {
        files: registryItem.files,
        registryDependencies: [...allUIDeps],
      });
    }

    // Write updated registry file
    await this.fileSystem.writeTextFile(
      localRegistryPath,
      JSON.stringify(registryFiles, null, 2)
    );

    // Generate consolidated registry.json
    await this.registryItemManager.generateRegistryJson();
  }

  async syncRegistry(): Promise<void> {
    const registryDir = this.fileSystem.joinPath(this.sourceDir, ".registry");

    try {
      for await (const entry of walk(registryDir, {
        exts: ["json"],
      })) {
        if (entry.isFile) {
          if (!entry.name.endsWith(".json")) {
            continue;
          }

          const componentName = this.fileSystem.basename(entry.path, ".json");
          const registryFilePath = this.fileSystem.joinPath(
            registryDir,
            `${componentName}.json`
          );

          const content = await this.fileSystem.readTextFile(registryFilePath);
          const registryFiles: { name: string; size: number; hash: string }[] =
            JSON.parse(content);

          const sourceFiles = registryFiles.map((file) => file.name);

          await this.addToRegistry(sourceFiles, componentName);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error syncing registry: ${message}`);
    }
  }

  async statusRegistry(): Promise<void> {
    const registryDir = this.fileSystem.joinPath(this.sourceDir, ".registry");
    const changedFiles: {
      componentName: string;
      fileName: string;
      status: "changed" | "missing" | "unchanged";
    }[] = [];

    try {
      for await (const entry of walk(registryDir, {
        exts: ["json"],
      })) {
        if (entry.isFile) {
          const componentName = this.fileSystem.basename(entry.path, ".json");
          const registryFilePath = this.fileSystem.joinPath(
            registryDir,
            componentName
          );

          console.log("registryFilePath", registryFilePath);

          const content = await this.fileSystem.readTextFile(registryFilePath);
          const registryFiles: { name: string; size: number; hash: string }[] =
            JSON.parse(content);

          for (const regFile of registryFiles) {
            const sourceFile = this.fileSystem.joinPath(
              this.sourceDir,
              regFile.name
            );

            try {
              const fileInfo = await Deno.stat(sourceFile);
              const fileContent = await Deno.readFile(sourceFile);
              const hash = await crypto.subtle.digest("SHA-256", fileContent);
              const hashArray = Array.from(new Uint8Array(hash));
              const hashHex = hashArray
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");

              if (fileInfo.size !== regFile.size || hashHex !== regFile.hash) {
                changedFiles.push({
                  componentName: componentName,
                  fileName: regFile.name,
                  status: "changed",
                });
              } else {
                changedFiles.push({
                  componentName: componentName,
                  fileName: regFile.name,
                  status: "unchanged",
                });
              }
            } catch (error: unknown) {
              changedFiles.push({
                componentName: componentName,
                fileName: regFile.name,
                status: "missing",
              });
            }
          }
        }
      }

      if (changedFiles.length > 0) {
        // Group changes by component
        const groupedChanges = changedFiles.reduce((acc, file) => {
          if (!acc[file.componentName]) {
            acc[file.componentName] = [];
          }
          acc[file.componentName].push(file);
          return acc;
        }, {} as Record<string, typeof changedFiles>);

        console.log("Registry Status:");
        for (const [component, files] of Object.entries(groupedChanges)) {
          const changedComponentFiles = files.filter(
            (f) => f.status !== "unchanged"
          );
          if (changedComponentFiles.length > 0) {
            console.log(`\n${component}:`);
            changedComponentFiles.forEach((file) => {
              console.log(`  ${file.status}: ${file.fileName}`);
            });
          }
        }
      } else {
        console.log("Registry is up to date.");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error checking registry status: ${message}`);
    }
  }
}
