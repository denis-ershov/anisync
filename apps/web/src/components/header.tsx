'use client';

import {
  Filter,
  LogIn,
  LogOut,
  Search,
  Settings,
  Tv2,
  User,
} from 'lucide-react';
import { Link, useRouter } from '@/navigation';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { Slider } from './ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useAuth } from '@/contexts/auth-context';
import { NotificationsBell } from '@/components/notifications-bell';

const STATUS_OPTIONS = [
  { label: 'Watching', value: 'watching' },
  { label: 'Planned', value: 'planned' },
  { label: 'Completed', value: 'completed' },
  { label: 'On Hold', value: 'on_hold' },
  { label: 'Dropped', value: 'dropped' },
] as const;

const DEFAULT_MIN_YEAR = 1990;
const DEFAULT_MIN_RATING = 0;
const DEFAULT_MAX_RATING = 10;
const DEFAULT_MIN_EPISODES = 1;
const DEFAULT_MAX_EPISODES = 200;

function parseListParam(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toggleValue(values: string[], value: string, checked: boolean) {
  if (checked) {
    return values.includes(value) ? values : [...values, value];
  }

  return values.filter((item) => item !== value);
}

export function Header() {
  const t = useTranslations('Header');
  const tGenres = useTranslations('Genres');
  const tFilters = useTranslations('Filters');
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const genres = ['Action', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi'];
  const types = ['TV', 'OVA', 'Movie', 'Special', 'ONA'];
  const currentYear = new Date().getFullYear();
  const [searchTerm, setSearchTerm] = useState('');
  const [yearRange, setYearRange] = useState([DEFAULT_MIN_YEAR, currentYear]);
  const [ratingRange, setRatingRange] = useState([DEFAULT_MIN_RATING, DEFAULT_MAX_RATING]);
  const [episodeRange, setEpisodeRange] = useState([DEFAULT_MIN_EPISODES, DEFAULT_MAX_EPISODES]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [studioFilter, setStudioFilter] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  useEffect(() => {
    setSearchTerm(searchParams.get('search') || '');
    setStatusFilter(searchParams.get('status') || '');
    setStudioFilter(searchParams.get('studio') || '');
    setSelectedGenres(parseListParam(searchParams.get('genres')));
    setSelectedTypes(parseListParam(searchParams.get('types')));
    setYearRange([
      Number(searchParams.get('minYear') || DEFAULT_MIN_YEAR),
      Number(searchParams.get('maxYear') || currentYear),
    ]);
    setRatingRange([
      Number(searchParams.get('minRating') || DEFAULT_MIN_RATING),
      Number(searchParams.get('maxRating') || DEFAULT_MAX_RATING),
    ]);
    setEpisodeRange([
      Number(searchParams.get('minEpisodes') || DEFAULT_MIN_EPISODES),
      Number(searchParams.get('maxEpisodes') || DEFAULT_MAX_EPISODES),
    ]);
  }, [currentYear, searchParams]);

  const updateQuery = (params: URLSearchParams) => {
    const next = params.toString();
    const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
    router.replace(url);
  };

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    else params.delete('search');

    if (statusFilter) params.set('status', statusFilter);
    else params.delete('status');

    if (studioFilter.trim()) params.set('studio', studioFilter.trim());
    else params.delete('studio');

    if (selectedGenres.length) params.set('genres', selectedGenres.join(','));
    else params.delete('genres');

    if (selectedTypes.length) params.set('types', selectedTypes.join(','));
    else params.delete('types');

    params.set('minYear', String(yearRange[0]));
    params.set('maxYear', String(yearRange[1]));
    params.set('minRating', String(ratingRange[0]));
    params.set('maxRating', String(ratingRange[1]));
    params.set('minEpisodes', String(episodeRange[0]));
    params.set('maxEpisodes', String(episodeRange[1]));
    updateQuery(params);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setStudioFilter('');
    setSelectedGenres([]);
    setSelectedTypes([]);
    setYearRange([DEFAULT_MIN_YEAR, currentYear]);
    setRatingRange([DEFAULT_MIN_RATING, DEFAULT_MAX_RATING]);
    setEpisodeRange([DEFAULT_MIN_EPISODES, DEFAULT_MAX_EPISODES]);
    updateQuery(new URLSearchParams());
  };

  const handleLogout = async () => {
    await logout();
    const locale = window.location.pathname.split('/')[1] || 'en';
    router.push(`/${locale}/login`);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Tv2 className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block font-headline">
              AniSync
            </span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('searchPlaceholder')}
                className="pl-9"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    applyFilters();
                  }
                }}
              />
            </div>
          </div>
          <nav className="flex items-center space-x-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                  <span className="sr-only">{t('filters')}</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="flex flex-col">
                <SheetHeader>
                  <SheetTitle>{t('filters')}</SheetTitle>
                  <SheetDescription>{t('filterDescription')}</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto pr-4">
                  <Accordion
                    type="multiple"
                    defaultValue={['genres', 'year']}
                    className="w-full"
                  >
                    <AccordionItem value="genres">
                      <AccordionTrigger>{tFilters('genres')}</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-2">
                          {genres.map((genre) => (
                            <div
                              key={genre}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`genre-${genre}`}
                                checked={selectedGenres.includes(genre)}
                                onCheckedChange={(checked) =>
                                  setSelectedGenres((current) => toggleValue(current, genre, checked === true))
                                }
                              />
                              <Label
                                htmlFor={`genre-${genre}`}
                                className="font-normal"
                              >
                                {tGenres(genre)}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="year">
                      <AccordionTrigger>
                        {tFilters('releaseYear')}
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-2">
                        <Slider
                          value={yearRange}
                          onValueChange={setYearRange}
                          min={1970}
                          max={currentYear}
                          step={1}
                        />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{yearRange[0]}</span>
                          <span>{yearRange[1]}</span>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="status">
                      <AccordionTrigger>
                        {tFilters('status.title')}
                      </AccordionTrigger>
                      <AccordionContent>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={tFilters('status.placeholder')}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem
                                key={status.value}
                                value={status.value}
                              >
                                {tFilters(`status.${status.label}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="type">
                      <AccordionTrigger>{tFilters('type.title')}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {types.map((type) => (
                            <div
                              key={type}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`type-${type}`}
                                checked={selectedTypes.includes(type)}
                                onCheckedChange={(checked) =>
                                  setSelectedTypes((current) => toggleValue(current, type, checked === true))
                                }
                              />
                              <Label
                                htmlFor={`type-${type}`}
                                className="font-normal"
                              >
                                {tFilters(`type.${type}`)}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="studio">
                      <AccordionTrigger>{tFilters('studio')}</AccordionTrigger>
                      <AccordionContent>
                        <Input
                          placeholder={tFilters('studioPlaceholder')}
                          value={studioFilter}
                          onChange={(event) => setStudioFilter(event.target.value)}
                        />
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="rating">
                      <AccordionTrigger>{tFilters('rating')}</AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-2">
                        <Slider
                          value={ratingRange}
                          onValueChange={setRatingRange}
                          min={0}
                          max={10}
                          step={0.1}
                        />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{ratingRange[0]}</span>
                          <span>{ratingRange[1]}</span>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="episodes">
                      <AccordionTrigger>{tFilters('episodes')}</AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-2">
                        <Slider
                          value={episodeRange}
                          onValueChange={setEpisodeRange}
                          min={DEFAULT_MIN_EPISODES}
                          max={DEFAULT_MAX_EPISODES}
                          step={1}
                        />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{episodeRange[0]}</span>
                          <span>{episodeRange[1] >= 200 ? '200+' : episodeRange[1]}</span>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
                <SheetFooter className="pt-4">
                  <Button variant="outline" className="w-full" onClick={resetFilters}>
                    {tFilters('reset')}
                  </Button>
                  <Button className="w-full" onClick={applyFilters}>{tFilters('apply')}</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            {user ? (
              <>
              <NotificationsBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-11 w-11 min-h-11 min-w-11 rounded-full cursor-pointer"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {user.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.username}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/profile">
                        <User className="mr-2 h-4 w-4" />
                        <span>{t('profile')}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>{t('settings')}</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('logout')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </>
            ) : (
              <Button asChild>
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  {t('login')}
                </Link>
              </Button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
