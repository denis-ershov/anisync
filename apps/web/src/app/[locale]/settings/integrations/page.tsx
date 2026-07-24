'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { UserIntegration } from "@/lib/types";
import { SyncQueuePanel } from '@/components/sync-queue-panel';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface IntegrationService {
  name: 'shikimori' | 'myanimelist' | 'anilist';
  displayName: string;
  description: string;
}

function ServiceIcon({ service, size }: { service: IntegrationService['name']; size: number }) {
  const className = "rounded object-contain shrink-0";

  if (service === 'myanimelist') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" width={size} height={size} className={className} aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#2563eb" />
        <path d="M16 46V18h8l8 12 8-12h8v28h-8V30l-8 12-8-12v16h-8Z" fill="#fff" />
      </svg>
    );
  }

  if (service === 'anilist') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" width={size} height={size} className={className} aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#111827" />
        <path d="M18 48 29 16h8l11 32h-8l-2.1-6.5H26.1L24 48h-6Zm10.3-13h7.4L32 24.6 28.3 35Z" fill="#60a5fa" />
        <rect x="44" y="20" width="6" height="28" rx="3" fill="#22d3ee" />
      </svg>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104.5 104.5" width={size} height={size} className={className} aria-hidden="true">
      <rect width="104.5" height="104.5" rx="20" fill="#fff" />
      <g transform="matrix(0.012775 0 0 0.012775 -15.304452 -9.893285)">
        <path d="M1725 8911c-6-5-39-19-73-32-35-12-66-28-69-36-3-8 25-41 68-80 127-114 229-225 284-308 29-44 81-111 115-150 191-213 444-597 655-994 136-256 145-283 157-476 15-246 4-566-31-900-17-159-31-294-31-298 0-13-28-2-249 96-142 63-216 102-242 126-21 20-78 57-127 84-107 57-135 59-307 22-162-34-232-73-397-218-38-33-68-65-68-71 0-11-68-114-164-249l-48-68 17-64c14-52 17-91 13-198-4-88-2-141 6-153 6-10 9-43 7-71l-3-52 59-27c33-16 75-27 98-26 28 0 48-7 65-22 72-65 125-81 180-53 24 12 25 15 21 108-4 110-3 111 84 129 84 17 192 7 478-45 265-48 630-105 671-105 19 0 35-13 65-54 22-29 63-74 93-100l53-48 90 7c160 11 347 36 407 55 57 18 63 18 171 0 62-10 159-23 217-29 264-28 300-34 311-47 7-9 17-11 28-4 12 6 25 4 42-5 95-55 109-59 259-61 84-1 177-8 221-17 198-41 788-114 1066-133l102-7-14-28c-20-37-19-49 3-47 9 1 46 0 82 0l65-2 53-73c29-39 59-81 67-92 13-19 16-18 73 38 33 33 70 81 83 108l23 49 145-5c214-7 786-18 856-16 33 1 111 8 173 16 62 8 133 15 158 15 54 0 55 5-43-127-68-91-158-172-221-199-19-7-47-25-63-38-16-14-95-46-184-76-88-29-168-62-184-76-16-13-35-24-42-24-8 0-56-9-106-21-77-18-93-25-93-40 0-35 89-20 293 50 86 29 117 36 117 26 0-9-53-31-145-62-86-28-145-53-145-60 0-7 8-13 17-13 25 0 8-11-29-19-23-5-32-12-30-24 2-9-2-17-9-17-6 0-9-7-5-15 3-8 2-15-3-15-13 0-46 41-85 106-20 34-42 64-49 66-6 3-43 1-82-3-38-4-80-8-92-8-16-1-23-7-23-19 0-17-15-20-131-31-95-9-134-10-142-9-15 15-27 14-27-3 0-10-16-16-52-20-68-7-331-28-385-31-22-2-46-6-52-9-15-10-33 3-27 19 2 7-2 16-10 19-22 9-22 9-26-22-3-27-4-27-85-30-53-2-83 1-83 8 0 5 8 10 18 10 9 0 33 10 52 22 19 11 51 22 70 24 19 1 41 2 48 3 6 1 12 6 12 12 0 6-16 10-37 9-21-1-65-1-98 0l-60 2 40 10c23 6 49 22 63 38l22 29-57 11c-32 7-64 15-72 18-12 4-13-5-7-52l6-58-37 7c-20 4-47 15-60 25-19 14-38 17-95 15l-72-3-9-33c-13-51-21-53-51-14-15 19-34 35-42 35-11 0-13 6-9 20 4 13 2 20-7 20-7 1-165 3-351 5-186 2-362 9-390 15-29 5-65 12-82 14-16 1 0 4 37 5 36 0 73 4 82 7 44 17 1 24-148 24-166 0-198 7-161 34 15 11 9 14-45 19-35 4-84 7-109 7-38 1-43 2-27 12 11 6 41 8 72 5 54-6 70 4 37 22-10 5-67 11-128 14-109 6-223 31-247 55-6 6-37 12-68 12-30 0-71 5-90 10-19 6-89 15-155 21-79 6-134 16-160 29-37 18-60 19-335 14-286-4-401-12-485-33-22-6-83-20-135-31-151-34-422-182-531-290-103-101-116-134-165-415-23-135-25-168-21-330 5-206 18-266 91-421 151-318 375-464 610-396 103 30 215 52 260 52 72 0 216 22 226 36 21 24-22 32-205 36-201 6-248 14-351 64-75 36-117 82-150 161l-16 38 45 40c86 77 235 152 397 198 47 14 186 39 310 56 124 17 234 36 244 42 11 6 31 13 45 15 14 2 70 9 124 16 100 12 140 35 45 25-43-4-49-3-30 5 16 8 42 8 91 1 70-11 121-7 121 8 0 5-7 9-17 9-9 0-14 2-11 5 3 4 48 10 99 16 260 27 885 89 898 89 9 0 23 5 31 10 13 9 13 12-3 24-15 12-12 14 35 24 44 8 54 7 64-6 9-13 37-16 157-16 141-1 146 0 156 21 9 20 6 22-40 32-28 6-58 12-67 12-58 5 266 38 376 39 46 0 143 9 215 21 112 18 172 21 392 20 143-1 319 3 390 10 90 8 147 8 185 1 33-6 57-7 61-1 3 5 57 18 120 30 63 11 141 29 174 39 66 21 267 55 416 69 52 6 141 23 199 39 58 17 139 37 180 45 130 27 366 117 385 146 3 6 38 27 78 48 185 97 296 289 326 563 6 58 6 89-1 98-14 16-15 16 65 35 80 19 161 63 153 83-3 8-8 20-11 27-9 20 58 91 101 106 22 8 54 24 71 35 29 18 33 26 33 65 0 35 9 58 40 106 22 33 55 76 75 95 39 37 44 68 21 116-8 16-27 94-41 174-30 164-36 175-127 221-57 29-63 35-118 119-46 69-38 96 41 151 53 37-7 30-94-11-45-21-79-15-136 24-40 28-58 32-153 41l-66 5-127-85c-74-50-137-85-152-85-13 0-86-34-161-77-75-42-153-84-172-94-30-15-545-159-569-159-5 0 16 62 46 138 88 223 144 424 173 627 40 283 104 646 121 699 53 156 143 300 399 631 241 313 528 701 550 745 34 66 100 320 100 383 0 12-13 24-39 34-41 16-51 37-51 107 0 45-44 108-137 198-69 67-85 77-128 84-77 13-215 10-265-5-108-32-114-36-133-76-11-22-36-60-56-85-20-25-57-74-83-110-63-89-127-146-206-182-66-30-173-99-283-184-84-64-149-141-199-234-25-46-69-118-98-159-72-104-107-180-139-297-25-92-27-115-29-324-2-124-7-450-12-725-11-526-12-541-66-750-26-102-180-603-188-610-2-3-61-10-130-16-108-10-143-9-245 6-86 13-145 15-220 10-82-5-103-4-103 7 0 46 37 206 76 329 47 148 203 889 244 1155 25 163 27 424 5 640-18 175-38 263-94 399-36 89-48 107-106 161-66 62-85 94-85 144 0 34-75 140-117 165-15 9-44 41-63 72-19 30-44 59-54 65-10 6-38 28-61 49-57 52-105 70-201 77-148 9-158 3-340-177-100-99-190-177-241-211-64-42-86-64-97-92-19-45-135-147-214-187-34-17-63-39-69-54-6-13-37-44-69-68-32-24-66-59-76-78-11-19-30-43-43-53-13-10-34-37-46-58-13-22-34-47-47-56-20-13-23-22-19-49 3-21 0-41-9-54-14-19-13-21 5-21 12 0 21-3 21-6 0-3-38-52-85-109-47-57-85-106-85-109 0-3 62 25 138 63 75 37 223 102 327 144 105 42 244 99 310 128 133 59 178 65 222 33 61-44 64-61 73-435 10-376 18-483 57-824 23-199 26-272 26-542 1-172-2-315-5-318-8-8-247 15-317 31-36 8-105 28-154 40-49 16-144 40-211 54-66 13-152 31-191 39-38 8-158 24-265 37l-194 22-41 38c-22 20-68 53-103 74-67 39-75 50-91 133-34 167-14 380 54 607 41 132 57 168 123 270 114 177 150 295 159 520 5 128 7 144 33 190 15 28 30 62 33 76 9 34-26 170-57 223-13 23-26 54-30 69-10 43-90 116-191 176-70 42-125 88-248 210-88 86-193 197-235 246-134 160-385 414-414 420-15 4-46 21-70 39-65 50-105 67-167 73-31 2-73 11-94 19-53 20-116 18-151-5l-29-20-72 40c-74 40-94 46-110 30zm6166-4640c-14-10-31-17-38-14-18 7 14 32 42 32 18 1 18-1-4-18zm-721-631c13-8 12-10-4-10-10 0-25-8-32-17-12-17-13-16-14 4 0 18 10 30 30 32 3 0 12-4 20-9zm-1670-50c8-5 12-12 8-15-10-10-49 5-43 16 8 11 16 11 35-1zm1253-61c49-10 56-15 59-38 3-25 6-26 58-26 30 1 84 4 120 8 63 6 51-2-22-18-16-3-28-10-28-16 0-7 22-8 66-3 50 5 65 4 60-5-4-7-16-9-26-6-10 3-43-1-73-10-53-15-56-15-97 6-35 19-52 21-115 16-47-3-77-1-84 6-8 8-19 5-41-11-26-19-41-22-127-21l-98 1 168 33c93 18 171 36 174 39 11 11-39 6-217-19-96-14-188-24-205-24-16 1 7 7 53 14 123 19 222 43 267 65 50 23 41 22 108 9z" fill="#000" />
        <path d="M5800 3701c0-24 14-41 34-41 23 0 35 7 55 33 12 16 10 17-38 17-28 0-51-4-51-9z" fill="#000" />
        <path d="M4885 3145c30-25 64-39 123-49 38-6 41 3 10 31-37 33-64 43-115 43l-48-1 30-24z" fill="#000" />
        <path d="M7637 2964c-3-3-3-36 0-73 6-74-10-119-62-174-33-34-211-124-329-166-266-94-975-167-1948-201-602-21-871-36-971-55-38-7-85-11-102-8-18 3-35 0-39-6-4-7-34-8-86-4-57 4-80 3-80-6 0-6-16-11-39-11-45 0-63-16-31-28 15-5-22-15-122-30-168-26-158-26-158-7 0 8-4 15-10 15-5 0-10-5-10-11 0-8-5-8-15 1-18 15-45 6-45-15 0-19-25-29-115-44-38-7-80-14-92-17-13-2-23 0-23 6 0 5 12 10 28 10 43 0 72 11 72 27 0 12-10 14-52 8-94-13-143-29-146-47-2-12 3-18 15-18 15 0 16-2 3-10-8-5-24-10-34-10-11 0-27-6-35-13-9-8-106-42-216-76-519-162-713-263-903-466-62-66-142-173-142-189 0-16 31-3 41 17 14 27 73 83 129 122 23 16 54 44 67 62 14 18 30 33 35 33 5 0 36 21 69 46 65 50 205 127 221 122 6-2-8-17-31-32-45-32-112-111-220-260l-71-98 0 53c-1 48-2 52-14 36-8-10-29-61-47-113-24-69-44-108-76-145-49-58-67-88-59-97 10-9 77 60 95 69 9 20 31 54 49 75l32 40 0-33c0-43 12-41 118 12 161 81 275 118 382 123 58 3 140 16 210 33 150 38 312 66 480 83 136 14 278 16 297 4 5-3 75-2 154 3 269 17 363 21 358 16-5-5-532-46-591-46-24 0-28-3-19-13 9-11 55-13 234-9 147 3 235 1 258-6 34-11 188-25 459-42 99-6 163-15 202-29 50-17 169-41 353-71 114-19 143-28 184-58 35-26 54-32 95-32 28-1 71-5 96-10 29-6 151-2 350 9 175 11 335 15 375 11 112-11 471 6 638 30 118 17 176 31 257 63 58 22 134 50 170 62 149 51 258 123 378 249 102 108 122 151 207 431 65 214 67 224 75 370 12 217-4 270-112 365-27 23-48 50-48 61 0 55-64 112-93 83z" fill="#000" />
      </g>
    </svg>
  );
}

export default function IntegrationsPage() {
  const t = useTranslations('SettingsIntegrations');
  const { toast } = useToast();
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<UserIntegration[]>([]);
  const [primaryService, setPrimaryService] = useState<string | null>(null);
  const [secondaryService, setSecondaryService] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncJob, setSyncJob] = useState<{
    id: number;
    status: string;
    direction?: string | null;
    error?: string | null;
    summary?: Record<string, unknown>;
    createdAt?: string;
    finishedAt?: string | null;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const integrationServices: IntegrationService[] = [
    {
      name: 'myanimelist',
      displayName: t('AvailableIntegrations.myAnimeListName'),
      description: t('AvailableIntegrations.myAnimeListDescription'),
    },
    {
      name: 'anilist',
      displayName: t('AvailableIntegrations.aniListName'),
      description: t('AvailableIntegrations.aniListDescription'),
    },
    {
      name: 'shikimori',
      displayName: t('AvailableIntegrations.shikimoriName'),
      description: t('AvailableIntegrations.shikimoriDescription'),
    }
  ];

  useEffect(() => {
    if (user) {
      fetchIntegrations();
      fetchSyncStatus();
    }
  }, [user]);

  useEffect(() => {
    if (!syncJob || (syncJob.status !== 'pending' && syncJob.status !== 'running')) {
      return;
    }

    const intervalId = window.setInterval(() => {
      fetchSyncJob(syncJob.id);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [syncJob]);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch('/api/user/integrations');
      if (response.ok) {
        const data = await response.json();
        setIntegrations(data.integrations);
        setPrimaryService(data.settings?.primaryService || null);
        setSecondaryService(data.settings?.secondaryService || null);
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/user/integrations/sync', {
        cache: 'no-store',
      });
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const latestJob = data.activeJob || data.jobs?.[0] || null;
      setSyncJob(latestJob);
      setIsSyncing(Boolean(latestJob && (latestJob.status === 'pending' || latestJob.status === 'running')));
    } catch {
      // Best-effort status polling; no UI interruption needed.
    }
  };

  const fetchSyncJob = async (jobId: number) => {
    try {
      const response = await fetch(`/api/user/integrations/sync/${jobId}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setSyncJob(data.job);
      const active = data.job.status === 'pending' || data.job.status === 'running';
      setIsSyncing(active);

      if (data.job.status === 'completed') {
        const imported = Number(data.job.summary?.imported || 0);
        toast({
          title: t('syncStarted'),
          description: `${t('syncStartedDescription')} Imported ${imported} entries.`,
        });
      }

      if (data.job.status === 'failed') {
        toast({
          variant: "destructive",
          title: t('syncError'),
          description: data.job.error || t('syncErrorDescription'),
        });
      }
    } catch {
      // Best-effort polling.
    }
  };

  const handleConnect = async (serviceName: string) => {
    try {
      const response = await fetch(`/api/integrations/${serviceName}/auth-url`);
      if (response.ok) {
        const data = await response.json();
        window.open(data.authUrl, '_blank');
      } else {
        throw new Error('Failed to get auth URL');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('connectionError'),
        description: t('connectionErrorDescription'),
      });
    }
  };

  const handleDisconnect = async (serviceName: string) => {
    try {
      const response = await fetch(`/api/user/integrations/${serviceName}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: t('disconnected'),
          description: t('disconnectedDescription'),
        });
        fetchIntegrations();
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('disconnectError'),
        description: t('disconnectErrorDescription'),
      });
    }
  };

  const handleSyncToggle = async (serviceName: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/user/integrations/${serviceName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ automaticSync: enabled }),
      });

      if (response.ok) {
        toast({
          title: t('syncUpdated'),
          description: t('syncUpdatedDescription'),
        });
        fetchIntegrations();
      } else {
        throw new Error('Failed to update sync settings');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('updateError'),
        description: t('updateErrorDescription'),
      });
    }
  };

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      const response = await fetch('/api/user/integrations/sync', {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        setSyncJob(result.job);
        toast({
          title: t('syncStarted'),
          description: result.queued ? t('syncStartedDescription') : t('syncAlreadyRunning'),
        });
      } else {
        throw new Error('Failed to start sync');
      }
    } catch (error) {
      setIsSyncing(false);
      toast({
        variant: "destructive",
        title: t('syncError'),
        description: t('syncErrorDescription'),
      });
    }
  };

  const handleCatalogSync = async () => {
    try {
      setIsSyncing(true);
      const response = await fetch('/api/user/integrations/sync/catalog', {
        method: 'POST',
      });
      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        setSyncJob(result.job);
        toast({
          title: t('catalogSyncStarted'),
          description: result.queued ? t('catalogSyncStartedDescription') : t('syncAlreadyRunning'),
        });
      } else {
        throw new Error(result.error || 'Failed to start catalog sync');
      }
    } catch (error) {
      setIsSyncing(false);
      toast({
        variant: 'destructive',
        title: t('syncError'),
        description: error instanceof Error ? error.message : t('syncErrorDescription'),
      });
    }
  };

  const handlePrimaryServiceChange = async (serviceName: string | null) => {
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ primaryService: serviceName || null }),
      });

      if (response.ok) {
        const data = await response.json();
        setPrimaryService(serviceName);
        if (data.settings?.secondaryService !== undefined) {
          setSecondaryService(data.settings.secondaryService || null);
        } else if (secondaryService === serviceName) {
          setSecondaryService(null);
        }
        toast({
          title: t('primaryServiceUpdated'),
          description: t('primaryServiceUpdatedDescription'),
        });
      } else {
        throw new Error('Failed to update primary service');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('updateError'),
        description: t('updateErrorDescription'),
      });
    }
  };

  const handleSecondaryServiceChange = async (serviceName: string) => {
    const next = serviceName === '__none__' ? null : serviceName;
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ secondaryService: next }),
      });

      if (response.ok) {
        setSecondaryService(next);
        toast({
          title: t('secondaryServiceUpdated'),
          description: t('secondaryServiceUpdatedDescription'),
        });
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update secondary service');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('updateError'),
        description: error instanceof Error ? error.message : t('updateErrorDescription'),
      });
    }
  };

  const getIntegrationStatus = (serviceName: string) => {
    return integrations.find(integration => integration.serviceName === serviceName);
  };

  const connectedServices = integrationServices.filter((service) => Boolean(getIntegrationStatus(service.name)));
  const secondaryCandidates = connectedServices.filter((service) => service.name !== primaryService);
  const canCatalogSync = Boolean(primaryService) && secondaryCandidates.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('PrimaryService.title')}</CardTitle>
          <CardDescription>
            {t('PrimaryService.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={primaryService || ''} onValueChange={handlePrimaryServiceChange}>
            {connectedServices.map((service) => (
              <div key={service.name} className="flex items-center space-x-2 rounded-lg border p-4">
                <RadioGroupItem value={service.name} id={`primary-${service.name}`} />
                <Label htmlFor={`primary-${service.name}`} className="flex items-center space-x-3 cursor-pointer w-full">
                  <ServiceIcon service={service.name} size={32} />
                  <div>
                    <p className="font-medium">{service.displayName}</p>
                    {primaryService === service.name && (
                      <p className="text-xs text-muted-foreground">{t('PrimaryService.isPrimary')}</p>
                    )}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('SecondaryService.title')}</CardTitle>
          <CardDescription>
            {t('SecondaryService.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={secondaryService || '__none__'}
            onValueChange={handleSecondaryServiceChange}
            disabled={!primaryService || secondaryCandidates.length === 0}
          >
            <div className="flex items-center space-x-2 rounded-lg border p-4">
              <RadioGroupItem value="__none__" id="secondary-none" />
              <Label htmlFor="secondary-none" className="cursor-pointer w-full">
                <p className="font-medium">{t('SecondaryService.none')}</p>
                <p className="text-xs text-muted-foreground">{t('SecondaryService.noneHint')}</p>
              </Label>
            </div>
            {secondaryCandidates.map((service) => (
              <div key={service.name} className="flex items-center space-x-2 rounded-lg border p-4">
                <RadioGroupItem value={service.name} id={`secondary-${service.name}`} />
                <Label htmlFor={`secondary-${service.name}`} className="flex items-center space-x-3 cursor-pointer w-full">
                  <ServiceIcon service={service.name} size={32} />
                  <div>
                    <p className="font-medium">{service.displayName}</p>
                    {secondaryService === service.name && (
                      <p className="text-xs text-muted-foreground">{t('SecondaryService.isSecondary')}</p>
                    )}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('SyncOptions.title')}</CardTitle>
          <CardDescription>
            {t('SyncOptions.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleManualSync} disabled={integrations.length === 0 || isSyncing}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('SyncOptions.manualSyncButton')}
            </Button>
            <Button
              variant="secondary"
              onClick={handleCatalogSync}
              disabled={!canCatalogSync || isSyncing}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('SyncOptions.catalogSyncButton')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t('SyncOptions.catalogSyncHint')}</p>
          {syncJob && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('SyncOptions.lastSyncJob')}</span>
                <Badge variant={syncJob.status === 'failed' ? 'destructive' : 'secondary'}>
                  {syncJob.status}
                </Badge>
              </div>
              {syncJob.direction && (
                <p className="text-xs text-muted-foreground">{syncJob.direction}</p>
              )}
              <p className="text-sm text-muted-foreground">
                #{syncJob.id} {syncJob.createdAt ? new Date(syncJob.createdAt).toLocaleString() : ''}
              </p>
              {typeof syncJob.summary?.imported === 'number' && (
                <p className="text-sm text-muted-foreground">
                  {t('SyncOptions.importedEntries', { count: Number(syncJob.summary.imported) })}
                </p>
              )}
              {typeof syncJob.summary?.pushed === 'number' && (
                <p className="text-sm text-muted-foreground">
                  {t('SyncOptions.pushedEntries', { count: Number(syncJob.summary.pushed) })}
                </p>
              )}
              {syncJob.error && (
                <p className="text-sm text-destructive">{syncJob.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <SyncQueuePanel />
      
      <div className="space-y-4">
        <h3 className="text-xl font-bold tracking-tight">{t('AvailableIntegrations.title')}</h3>
        <div className="grid gap-6 md:grid-cols-2">
          {integrationServices.map((service) => {
            const integration = getIntegrationStatus(service.name);
            const isConnected = !!integration;
            
            return (
              <Card key={service.name}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <ServiceIcon service={service.name} size={40} />
                    <div>
                      <CardTitle className="text-xl">{service.displayName}</CardTitle>
                      {isConnected && (
                        <div className="flex items-center space-x-2 mt-1">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <Badge variant="secondary" className="text-xs">
                            {integration.username}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isConnected ? (
                      <Button 
                        variant="outline" 
                        onClick={() => handleDisconnect(service.name)}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        {t('disconnect')}
                      </Button>
                    ) : (
                      <Button onClick={() => handleConnect(service.name)}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {t('AvailableIntegrations.connectButton')}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                  
                  {isConnected && (
                    <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label htmlFor={`sync-${service.name}`} className="text-base">
                          {t('SyncOptions.automaticSync')}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {t('SyncOptions.automaticSyncDescription')}
                        </p>
                      </div>
                      <Switch
                        id={`sync-${service.name}`}
                        checked={integration.automaticSync}
                        onCheckedChange={(enabled) => handleSyncToggle(service.name, enabled)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
