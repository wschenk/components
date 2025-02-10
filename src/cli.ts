#!/usr/bin/env -S deno run -A --unstable

import { parse } from "https://deno.land/std/flags/mod.ts";
import { RegistryManager } from "./registry_manager.ts";
import { CONFIG } from "./config.ts";
import { RegistryItem } from "./interfaces.ts";

async function rebuildUI() {
  const process = Deno.run({
    cmd: ["pnpx", "shadcn", "build"],
  });
  const status = await process.status();

  if (!status.success) {
    console.error("Failed to rebuild UI components.");
    Deno.exit(1);
  }
}

export async function main() {
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
        await manager.registryItemManager.updateRegistryItem(
          componentName as string,
          {
            registryDependencies: deps,
          }
        );
        break;
      }
      case "addDep": {
        const [componentName, ...deps] = restArgs.map(String);
        await manager.registryItemManager.updateRegistryItem(
          componentName as string,
          {
            dependencies: deps,
          }
        );
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

        await manager.registryItemManager.updateRegistryItem(
          componentName as string,
          updates
        );
        break;
      }
      case "rebuildRegistry": {
        await manager.registryItemManager.generateRegistryJson();
        break;
      }
      case "rebuildUI": {
        await rebuildUI();
        break;
      }
      case "sync": {
        await manager.syncRegistry();
        break;
      }
      case "status": {
        await manager.statusRegistry();
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

// Check if this is the main module being run
if (import.meta.main) {
  await main();
}
