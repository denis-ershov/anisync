import { animeJobs } from '@/modules/anime/jobs';
import { animeManifest } from '@/modules/anime/manifest';
import { exampleManifest } from '@/modules/example/manifest';
import { platformManifest } from '@/modules/platform/manifest';
import { releasesJobs } from '@/modules/releases/jobs';
import { releasesManifest } from '@/modules/releases/manifest';
import { torrentsJobs } from '@/modules/torrents/jobs';
import { torrentsManifest } from '@/modules/torrents/manifest';
import type { ModuleManifest, ModuleNavItem } from '@/modules/types';

/** All registered product modules (order stable for docs/debug). */
export const moduleManifests: ModuleManifest[] = [
  platformManifest,
  animeManifest,
  releasesManifest,
  torrentsManifest,
  exampleManifest,
];

/** Nav entries for PlatformNav (excludes shell + stubs without nav). */
export function getNavManifests(): ModuleManifest[] {
  return moduleManifests
    .filter((m) => m.nav.length > 0)
    .sort((a, b) => (a.nav[0]?.order ?? 100) - (b.nav[0]?.order ?? 100));
}

export function getModuleById(id: string): ModuleManifest | undefined {
  return moduleManifests.find((m) => m.id === id);
}

export type ModuleJobsRegistry = {
  moduleId: string;
  queues: readonly string[];
};

export function getModuleJobsRegistry(): ModuleJobsRegistry[] {
  return [
    { moduleId: 'anime', queues: animeJobs.queues },
    { moduleId: 'releases', queues: releasesJobs.queues },
    { moduleId: 'torrents', queues: torrentsJobs.queues },
  ];
}

export type { ModuleManifest, ModuleNavItem };
