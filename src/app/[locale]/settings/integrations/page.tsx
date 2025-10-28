'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { RefreshCw, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { UserIntegration } from "@/lib/types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface IntegrationService {
  name: 'shikimori' | 'myanimelist' | 'anilist';
  displayName: string;
  description: string;
  icon: string;
  authUrl: string;
}

export default function IntegrationsPage() {
  const t = useTranslations('SettingsIntegrations');
  const { toast } = useToast();
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<UserIntegration[]>([]);
  const [primaryService, setPrimaryService] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const integrationServices: IntegrationService[] = [
    {
      name: 'myanimelist',
      displayName: t('AvailableIntegrations.myAnimeListName'),
      description: t('AvailableIntegrations.myAnimeListDescription'),
      icon: 'https://myanimelist.net/img/common/pwa/launcher-icon-0-75x.png',
      authUrl: 'https://myanimelist.net/oauth/authorize'
    },
    {
      name: 'anilist',
      displayName: t('AvailableIntegrations.aniListName'),
      description: t('AvailableIntegrations.aniListDescription'),
      icon: 'https://anilist.co/img/icons/icon.svg',
      authUrl: 'https://anilist.co/api/v2/oauth/authorize'
    },
    {
      name: 'shikimori',
      displayName: t('AvailableIntegrations.shikimoriName'),
      description: t('AvailableIntegrations.shikimoriDescription'),
      icon: 'https://shikimori.one/favicons/favicon-192x192.png',
      authUrl: 'https://shikimori.one/oauth/authorize'
    }
  ];

  useEffect(() => {
    if (user) {
      fetchIntegrations();
    }
  }, [user]);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch('/api/user/integrations');
      if (response.ok) {
        const data = await response.json();
        setIntegrations(data.integrations);
        if (data.settings?.primary_service) {
          setPrimaryService(data.settings.primary_service);
        }
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setIsLoading(false);
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
        body: JSON.stringify({ automatic_sync: enabled }),
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
      const response = await fetch('/api/user/integrations/sync', {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: t('syncStarted'),
          description: t('syncStartedDescription'),
        });
      } else {
        throw new Error('Failed to start sync');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('syncError'),
        description: t('syncErrorDescription'),
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
        body: JSON.stringify({ primary_service: serviceName }),
      });

      if (response.ok) {
        setPrimaryService(serviceName);
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

  const getIntegrationStatus = (serviceName: string) => {
    return integrations.find(integration => integration.service_name === serviceName);
  };

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
            {integrationServices.map((service) => {
              const integration = getIntegrationStatus(service.name);
              if (!integration) return null;
              
              return (
                <div key={service.name} className="flex items-center space-x-2 rounded-lg border p-4">
                  <RadioGroupItem value={service.name} id={`primary-${service.name}`} />
                  <Label htmlFor={`primary-${service.name}`} className="flex items-center space-x-3 cursor-pointer w-full">
                    <Image 
                      src={service.icon} 
                      width={32} 
                      height={32} 
                      alt={service.displayName}
                      className="rounded"
                    />
                    <div>
                      <p className="font-medium">{service.displayName}</p>
                      {primaryService === service.name && (
                        <p className="text-xs text-muted-foreground">{t('PrimaryService.isPrimary')}</p>
                      )}
                    </div>
                  </Label>
                </div>
              );
            })}
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
          <Button onClick={handleManualSync} disabled={integrations.length === 0}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('SyncOptions.manualSyncButton')}
          </Button>
        </CardContent>
      </Card>
      
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
                    <Image 
                      src={service.icon} 
                      width={40} 
                      height={40} 
                      alt={service.displayName}
                      className="rounded"
                    />
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
                        checked={integration.automatic_sync}
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
