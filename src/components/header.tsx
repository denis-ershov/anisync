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
import { useState } from 'react';

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

export function Header() {
  const t = useTranslations('Header');
  const tGenres = useTranslations('Genres');
  const tFilters = useTranslations('Filters');
  const { user, logout } = useAuth();
  const router = useRouter();

  const genres = ['Action', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi'];
  const types = ['TV', 'OVA', 'Movie', 'Special', 'ONA'];
  const statuses = [
    'Watching',
    'Planned',
    'Completed',
    'On Hold',
    'Dropped',
    'Not Added',
  ];

  const currentYear = new Date().getFullYear();
  const [yearRange, setYearRange] = useState([1990, currentYear]);
  const [ratingRange, setRatingRange] = useState([0, 10]);
  const [episodeRange, setEpisodeRange] = useState([1, 100]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
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
                              <Checkbox id={`genre-${genre}`} />
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
                        <Select>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={tFilters('status.placeholder')}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {statuses.map((status) => (
                              <SelectItem
                                key={status}
                                value={status.toLowerCase()}
                              >
                                {tFilters(`status.${status}`)}
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
                              <Checkbox id={`type-${type}`} />
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
                        <Input placeholder={tFilters('studioPlaceholder')} />
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
                          min={1}
                          max={200}
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
                  <Button variant="outline" className="w-full">
                    {tFilters('reset')}
                  </Button>
                  <Button className="w-full">{tFilters('apply')}</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
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
