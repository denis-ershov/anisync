'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import type { Anime } from '@/types';
import { userAnimeList } from '@/lib/mock-data';
import { getAiRecommendation } from '@/lib/actions';
import { AnimeCard } from '@/components/anime-card';
import { AnimeDetailsDialog } from '@/components/anime-details-dialog';
import { RecommendationDialog } from '@/components/recommendation-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Sparkles, User, Tv2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageChanger from '@/components/language-changer';
import { useParams } from 'next/navigation';

export default function DashboardPage() {
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('score');
  
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  const [recommendation, setRecommendation] = useState<{ recommendation: string; reason: string } | null>(null);
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false);
  const [isAiLoading, startAiTransition] = useTransition();

  const { t } = useTranslation('common');
  const params = useParams();
  const locale = params.locale as string;

  useEffect(() => {
    // Simulate fetching data
    setTimeout(() => {
      setAnimeList(userAnimeList);
      setIsLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    if (selectedAnime) {
      setIsDetailsOpen(true);
    }
  }, [selectedAnime]);

  useEffect(() => {
    if (!isDetailsOpen) {
      setSelectedAnime(null);
    }
  }, [isDetailsOpen]);

  const filteredAndSortedAnime = useMemo(() => {
    return animeList
      .filter((anime) => anime.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'score') {
          return b.score - a.score;
        }
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
  }, [animeList, searchTerm, sortBy]);
  
  const handleGetRecommendation = () => {
    setIsRecommendationOpen(true);
    setRecommendation(null);
    startAiTransition(async () => {
      const result = await getAiRecommendation();
      setRecommendation(result);
    });
  };

  return (
    <>
      <div className="min-h-screen w-full">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border p-4">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Tv2 className="w-8 h-8 text-primary"/>
              <h1 className="text-2xl font-bold font-headline">AniSync</h1>
            </div>
             <div className="flex items-center gap-2">
              <LanguageChanger locale={locale} />
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
                <span className="sr-only">Profile</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto p-4 md:p-8">
          <div className="flex flex-col md:flex-row gap-4 mb-8 items-center">
            <div className="relative w-full md:flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('filter_by_title')}
                className="pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder={t('sort_by')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">{t('sort_by_score')}</SelectItem>
                  <SelectItem value="title">{t('sort_by_title')}</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleGetRecommendation} className="font-bold" disabled={isAiLoading}>
                <Sparkles className="mr-2 h-4 w-4" />
                {t('get_recommendation')}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="flex flex-col gap-2">
                  <Skeleton className="h-[300px] w-full" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {filteredAndSortedAnime.map((anime) => (
                <AnimeCard key={anime.id} anime={anime} onCardClick={setSelectedAnime} />
              ))}
            </div>
          )}

          {filteredAndSortedAnime.length === 0 && !isLoading && (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">{t('no_anime_found')}</p>
            </div>
          )}
        </main>
      </div>
      <AnimeDetailsDialog 
        anime={selectedAnime} 
        isOpen={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
      <RecommendationDialog 
        isOpen={isRecommendationOpen}
        onOpenChange={setIsRecommendationOpen}
        recommendation={recommendation}
        isLoading={isAiLoading}
      />
    </>
  );
}
