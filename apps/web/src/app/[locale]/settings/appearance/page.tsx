'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePathname, useRouter } from "@/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";

interface UserSettings {
  theme: 'light' | 'dark';
  language: 'en' | 'ru';
}

export default function AppearancePage() {
  const t = useTranslations('Appearance');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'dark',
    language: 'en'
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUserSettings();
  }, []);

  const fetchUserSettings = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.user?.settings) {
          setSettings(data.user.settings);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });

      if (response.ok) {
        const result = await response.json();
        setSettings(prev => ({ ...prev, ...newSettings }));
        toast({
          title: t('settingsUpdated'),
          description: t('settingsUpdatedDescription'),
        });
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('updateError'),
        description: t('updateErrorDescription'),
      });
    }
  };

  const handleThemeChange = (theme: 'light' | 'dark') => {
    updateSettings({ theme });
  };

  const handleLanguageChange = (language: 'en' | 'ru') => {
    updateSettings({ language });
    router.replace(pathname, {locale: language});
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
          <CardTitle>{t('Theme.title')}</CardTitle>
          <CardDescription>
            {t('Theme.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={settings.theme} 
            onValueChange={handleThemeChange}
            className="grid max-w-md grid-cols-2 gap-8 pt-2"
          >
            <Label className="[&:has([data-state=checked])>div]:border-primary">
              <RadioGroupItem value="light" className="sr-only" />
              <div className="items-center rounded-md border-2 border-muted p-1 hover:border-accent">
                <div className="space-y-2 rounded-sm bg-[#ecedef] p-2">
                  <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
                    <div className="h-2 w-[80px] rounded-lg bg-[#ecedef]" />
                    <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                  </div>
                  <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                    <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
                    <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                  </div>
                  <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                    <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
                    <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                  </div>
                </div>
              </div>
              <span className="block w-full p-2 text-center font-normal">
                {t('Theme.light')}
              </span>
            </Label>
            <Label className="[&:has([data-state=checked])>div]:border-primary">
              <RadioGroupItem value="dark" className="sr-only" />
              <div className="items-center rounded-md border-2 border-muted bg-popover p-1 hover:border-accent">
                <div className="space-y-2 rounded-sm bg-slate-950 p-2">
                  <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
                    <div className="h-2 w-[80px] rounded-lg bg-slate-400" />
                    <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
                  </div>
                  <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
                    <div className="h-4 w-4 rounded-full bg-slate-400" />
                    <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
                  </div>
                  <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
                    <div className="h-4 w-4 rounded-full bg-slate-400" />
                    <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
                  </div>
                </div>
              </div>
              <span className="block w-full p-2 text-center font-normal">
                {t('Theme.dark')}
              </span>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Language.title')}</CardTitle>
          <CardDescription>
            {t('Language.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
           <RadioGroup 
            value={settings.language} 
            onValueChange={handleLanguageChange} 
            className="grid max-w-md grid-cols-2 gap-4 pt-2"
           >
            <Label>
              <RadioGroupItem value="en" className="sr-only" />
              <div className={`p-4 rounded-md border-2 ${settings.language === 'en' ? 'border-primary' : 'border-muted'} hover:border-accent cursor-pointer`}>
                English
              </div>
            </Label>
             <Label>
              <RadioGroupItem value="ru" className="sr-only" />
              <div className={`p-4 rounded-md border-2 ${settings.language === 'ru' ? 'border-primary' : 'border-muted'} hover:border-accent cursor-pointer`}>
                Русский
              </div>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}
