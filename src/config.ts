// config.ts
export const CONFIG = {
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
  deno run cli.ts add <component-name> [--source=<dir>] [--registry=<dir>] <files...>
  deno run cli.ts addRegDep <component-name> [--registry=<dir>] <dependencies...>
  deno run cli.ts addDep <component-name> [--registry=<dir>] <npm-packages...>
  deno run cli.ts update <component-name> [--title=<title>] [--description=<desc>] [--type=<type>] [--author=<author>] [--docs=<docs>]
  deno run cli.ts rebuildRegistry [--registry=<dir>]
  deno run cli.ts rebuildUI
  deno run cli.ts sync
  deno run cli.ts status

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
