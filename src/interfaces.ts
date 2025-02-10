// interfaces.ts
export interface RegistryFile {
  path: string;
  type: string;
  target?: string;
}

export interface RegistryMeta {
  [key: string]: unknown;
}

export interface RegistryItem {
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

export interface Registry {
  $schema: string;
  name: string;
  homepage: string;
  items: RegistryItem[];
}
