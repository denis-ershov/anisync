'use client';

import Image from 'next/image';

import type { IntegrationServiceName } from '@/lib/types';

const SERVICE_ICONS: Record<IntegrationServiceName, string> = {
  shikimori: '/icons/shikimori.svg',
  myanimelist: '/icons/myanimelist.svg',
  anilist: '/icons/anilist.svg',
};

type IntegrationServiceIconProps = {
  service: IntegrationServiceName;
  size?: number;
  className?: string;
};

export function IntegrationServiceIcon({
  service,
  size = 40,
  className = 'rounded object-contain shrink-0',
}: IntegrationServiceIconProps) {
  return (
    <Image
      src={SERVICE_ICONS[service]}
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden
    />
  );
}
