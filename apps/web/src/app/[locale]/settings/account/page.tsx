'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale, useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "@/navigation";

export default function AccountPage() {
  const t = useTranslations('SettingsAccount');
  const { toast } = useToast();
  const router = useRouter();
  const locale = useLocale();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordSave = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/user/account/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to update password');
      }

      toast({
        title: t('Password.saveButton'),
        description: t('Password.description'),
      });
      router.push(`/${locale}/login`);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('title'),
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/user/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: deletePassword,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to delete account');
      }

      router.push(`/${locale}/register`);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('DeleteAccount.title'),
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
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
          <CardTitle>{t('Password.title')}</CardTitle>
          <CardDescription>
            {t('Password.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">{t('Password.current')}</Label>
            <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('Password.new')}</Label>
            <Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('Password.confirm')}</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
        </CardContent>
        <CardFooter>
          <Button disabled={isSubmitting} onClick={handlePasswordSave}>{t('Password.saveButton')}</Button>
        </CardFooter>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>{t('DeleteAccount.title')}</CardTitle>
          <CardDescription>
            {t('DeleteAccount.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="delete-password">{t('Password.current')}</Label>
            <Input id="delete-password" type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="destructive" disabled={isSubmitting} onClick={handleDeleteAccount}>{t('DeleteAccount.deleteButton')}</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
