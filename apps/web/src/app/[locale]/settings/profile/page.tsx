'use client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect } from "react";

const profileFormSchema = z.object({
  username: z
    .string()
    .min(2, {
      message: "Username must be at least 2 characters.",
    })
    .max(30, {
      message: "Username must not be longer than 30 characters.",
    }),
  email: z.string().min(1, { message: "Please select an email to display." }).email(),
  bio: z.string().max(160).min(4),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfileForm() {
  const t = useTranslations('SettingsProfile');
  const { user, updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      bio: user?.bio || "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (user) {
      form.reset({
        username: user.username,
        email: user.email,
        bio: user.bio || "",
      });
    }
  }, [user, form]);

  async function onSubmit(data: ProfileFormValues) {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        updateUser({ ...user!, ...result.user });
        toast({
          title: t('profileUpdated'),
          description: t('profileUpdatedDescription'),
        });
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('updateError'),
        description: t('updateErrorDescription'),
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('username.label')}</FormLabel>
              <FormControl>
                <Input placeholder={t('username.placeholder')} {...field} />
              </FormControl>
              <FormDescription>
                {t('username.description')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email.label')}</FormLabel>
               <FormControl>
                <Input placeholder={t('email.placeholder')} {...field} />
              </FormControl>
              <FormDescription>
                {t('email.description')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('bio.label')}</FormLabel>
              <FormControl>
                 <Textarea placeholder={t('bio.placeholder')} {...field} />
              </FormControl>
              <FormDescription>
                {t('bio.description')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? t('updating') : t('submitButton')}
        </Button>
      </form>
    </Form>
  );
}
