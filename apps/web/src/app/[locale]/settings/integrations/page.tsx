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
import { IntegrationServiceIcon } from '@/components/integration-service-icon';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface IntegrationService {
  name: 'shikimori' | 'myanimelist' | 'anilist';
  displayName: string;
  description: string;
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
                  <IntegrationServiceIcon service={service.name} size={32} />
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
                  <IntegrationServiceIcon service={service.name} size={32} />
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
                    <IntegrationServiceIcon service={service.name} size={40} />
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
