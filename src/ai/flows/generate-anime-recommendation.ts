// Use server directive.
'use server';

/**
 * @fileOverview Generates anime recommendations based on user viewing history and Shikimori data.
 *
 * - generateAnimeRecommendation - A function that generates anime recommendations.
 * - GenerateAnimeRecommendationInput - The input type for the generateAnimeRecommendation function.
 * - GenerateAnimeRecommendationOutput - The return type for the generateAnimeRecommendation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAnimeRecommendationInputSchema = z.object({
  userViewingHistory: z.string().describe('The viewing history of the user, as a JSON string.'),
  shikimoriData: z.string().describe('Data from Shikimori about anime, as a JSON string.'),
  currentWatchList: z.string().describe('The user current watch list, as a JSON string.'),
});

export type GenerateAnimeRecommendationInput = z.infer<
  typeof GenerateAnimeRecommendationInputSchema
>;

const GenerateAnimeRecommendationOutputSchema = z.object({
  recommendation: z.string().describe('The recommended anime title.'),
  reason: z.string().describe('The reasoning behind the recommendation.'),
});

export type GenerateAnimeRecommendationOutput = z.infer<
  typeof GenerateAnimeRecommendationOutputSchema
>;

export async function generateAnimeRecommendation(
  input: GenerateAnimeRecommendationInput
): Promise<GenerateAnimeRecommendationOutput> {
  return generateAnimeRecommendationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAnimeRecommendationPrompt',
  input: {schema: GenerateAnimeRecommendationInputSchema},
  output: {schema: GenerateAnimeRecommendationOutputSchema},
  prompt: `You are an AI anime recommendation expert.

Analyze the user's viewing history, data from Shikimori, and their current watch list to recommend an anime they might enjoy.

Ensure the recommendation is not on the user's current watch list.

User Viewing History: {{{userViewingHistory}}}
Shikimori Data: {{{shikimoriData}}}
Current Watch List: {{{currentWatchList}}}

Based on this information, what anime would you recommend and why?`,
});

const generateAnimeRecommendationFlow = ai.defineFlow(
  {
    name: 'generateAnimeRecommendationFlow',
    inputSchema: GenerateAnimeRecommendationInputSchema,
    outputSchema: GenerateAnimeRecommendationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
