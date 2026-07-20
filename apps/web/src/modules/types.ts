export type ModuleFeatureFlag = 'releases' | 'torrents' | null;

export type ModuleNavItem = {
  href: string;
  labelKey: string;
  order?: number;
};

export type ModuleManifest = {
  id: string;
  featureFlag: ModuleFeatureFlag;
  enabledByDefault: boolean;
  nav: ModuleNavItem[];
  apiPrefix?: string;
};
