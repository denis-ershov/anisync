export type Anime = {
  id: number;
  title: string;
  status: 'Watching' | 'Completed' | 'On-Hold' | 'Dropped' | 'Plan to Watch';
  score: number;
  episodes_watched: number;
  episodes_total: number;
  image_url: string;
  synopsis: string;
  genres: string[];
};
