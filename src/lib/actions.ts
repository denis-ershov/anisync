"use server";

import { generateAnimeRecommendation } from "@/ai/flows/generate-anime-recommendation";
import { userAnimeList, shikimoriAnimeData } from "@/lib/mock-data";

export async function getAiRecommendation() {
  try {
    const recommendation = await generateAnimeRecommendation({
      userViewingHistory: JSON.stringify(userAnimeList),
      shikimoriData: JSON.stringify(shikimoriAnimeData),
      currentWatchList: JSON.stringify(userAnimeList.filter(anime => anime.status === 'Watching')),
    });
    return recommendation;
  } catch (error) {
    console.error("Error generating recommendation:", error);
    return {
      recommendation: "Error",
      reason: "Could not generate a recommendation at this time. Please try again later.",
    };
  }
}
