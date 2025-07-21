'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface RecommendationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  recommendation: { recommendation: string; reason: string } | null;
  isLoading: boolean;
}

export function RecommendationDialog({
  isOpen,
  onOpenChange,
  recommendation,
  isLoading,
}: RecommendationDialogProps) {
  const { t } = useTranslation('common');

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-accent" />
          </div>
          <AlertDialogTitle className="text-center text-2xl font-headline">
            {isLoading ? t('generating_recommendation') : t('your_ai_recommendation')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {isLoading
              ? t('ai_analysis_description')
              : t('recommendation_ready_description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        )}
        {recommendation && !isLoading && (
          <div className="my-4 bg-card p-4 rounded-lg border">
            <h3 className="font-bold text-xl text-primary mb-2">{recommendation.recommendation}</h3>
            <p className="text-foreground/80">{recommendation.reason}</p>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>{t('close_button')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
