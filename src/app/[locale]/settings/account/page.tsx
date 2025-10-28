'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";

export default function AccountPage() {
  const t = useTranslations('SettingsAccount');
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
          <CardTitle>{t('Password.title')}</CardTitle>
          <CardDescription>
            {t('Password.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">{t('Password.current')}</Label>
            <Input id="current-password" type="password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('Password.new')}</Label>
            <Input id="new-password" type="password" />
          </div>
           <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('Password.confirm')}</Label>
            <Input id="confirm-password" type="password" />
          </div>
        </CardContent>
        <CardFooter>
          <Button>{t('Password.saveButton')}</Button>
        </CardFooter>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>{t('DeleteAccount.title')}</CardTitle>
          <CardDescription>
            {t('DeleteAccount.description')}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="destructive">{t('DeleteAccount.deleteButton')}</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
