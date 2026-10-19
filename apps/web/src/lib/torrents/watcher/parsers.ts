export function extractSeasonFromTitle(title: string | null | undefined): number | null {
  if (!title) {
    return null;
  }

  // Нормализуем кириллические С/Е → s/e в контексте сезонных маркеров
  const titleLower = title
    .toLowerCase()
    .replace(/(?:^|[^a-zа-яё0-9])с(\d)/g, (m) => m.replace(/с/, 's'))
    .replace(/(?:s\d{1,2})\s*е(\d)/g, (m) => m.replace(/е/, 'e'));

  const patterns = [
    /(?:^|[^0-9a-zа-яё])s(\d{1,2})\s*e\d{1,3}/i,
    /(?:^|[^0-9a-zа-яё])(\d{1,2})\s*(?:сезон|season)(?:[^0-9a-zа-яё]|$)/i,
    /(?:^|[^0-9a-zа-яё])s(?:eason)?\s*(\d{1,2})(?:[^0-9a-zа-яё]|$)/i,
    /(?:^|[^0-9a-zа-яё])сезон\s*(\d{1,2})(?:[^0-9a-zа-яё]|$)/i,
    // NxMM — формат EZTV / трекеров (3x01, 02x01-04)
    /(?:^|[^0-9a-zа-яё])(\d{1,2})x\d{1,3}(?:[^0-9a-zа-яё]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(titleLower);
    if (!match?.[1]) {
      continue;
    }
    const seasonNum = Number.parseInt(match[1], 10);
    if (Number.isFinite(seasonNum) && seasonNum >= 1 && seasonNum <= 100) {
      return seasonNum;
    }
  }

  return null;
}


export function extractEpisodeInfo(
  title: string | null | undefined
): { current: number; total: number | null } | null {
  if (!title) {
    return null;
  }

  // Нормализуем кириллические С/Е → s/e в контексте маркеров сезонов и серий
  const titleLower = title
    .toLowerCase()
    .replace(/(?:^|[^a-zа-яё0-9])с(\d)/g, (m) => m.replace(/с/, 's'))
    .replace(/(?:s\d{1,2})\s*е(\d)/g, (m) => m.replace(/е/, 'e'))
    .replace(/(?:^|[^a-zа-яё0-9])е(\d)/g, (m) => m.replace(/е/, 'e'));

  const totalPatterns = [
    // S01E01-04 of 10 / из 10
    /s\s*\d{1,2}\s*e\s*(\d{1,3})\s*-\s*e?\s*(\d{1,3})\s+(?:of|из|from)\s+(\d{1,3})/,
    // 02x01-04 of 10 / из 10 (например [02x01-04 из 10])
    /(?:^|[^a-zа-я0-9])\d{1,2}x(\d{1,3})\s*-\s*(\d{1,3})\s+(?:of|из|from)\s+(\d{1,3})/,
    // E01-04 of 10 / из 10
    /(?<![a-zа-я0-9])e\s*(\d{1,3})\s*-\s*e?\s*(\d{1,3})\s+(?:of|из|from)\s+(\d{1,3})/,
    // [01-04 из 10]
    /[\[(]\s*(\d{1,3})\s*-\s*(\d{1,3})\s+(?:из|from|of)\s+(\d{1,3})\s*[\])]/,
    // 1-4 серии из 10
    /(?:серии|серия|episodes?)\s+(\d{1,3})\s*-\s*(\d{1,3})\s+(?:из|from|of)\s+(\d{1,3})/,
    // Одиночные серии с общим числом: S02E04 of 10, 02x04 из 10, E04 of 10
    /s\s*\d{1,2}\s*e\s*(\d{1,3})\s+(?:of|из|from)\s+(\d{1,3})/,
    /(?:^|[^a-zа-я0-9])\d{1,2}x(\d{1,3})\s+(?:of|из|from)\s+(\d{1,3})/,
    /(?<![a-zа-я0-9])e\s*(\d{1,3})\s+(?:of|из|from)\s+(\d{1,3})/,
  ];

  for (const pattern of totalPatterns) {
    const match = pattern.exec(titleLower);
    if (!match) {
      continue;
    }
    // Если паттерн диапазона (3 группы захвата)
    if (match[3] !== undefined) {
      const startEp = Number.parseInt(match[1], 10);
      const endEp = Number.parseInt(match[2], 10);
      const totalEp = Number.parseInt(match[3], 10);
      if (startEp <= endEp && endEp <= totalEp) {
        return { current: endEp, total: totalEp };
      }
    } else if (match[2] !== undefined) {
      // Одиночная серия с общим числом (2 группы захвата)
      const currentEp = Number.parseInt(match[1], 10);
      const totalEp = Number.parseInt(match[2], 10);
      if (currentEp <= totalEp) {
        return { current: currentEp, total: totalEp };
      }
    }
  }

  const rangePatterns = [
    /s\s*\d{1,2}\s*e\s*(\d{1,3})\s*-\s*e?\s*(\d{1,3})/,
    /(?:^|[^a-zа-я0-9])\d{1,2}x(\d{1,3})\s*-\s*(\d{1,3})/,
    /(?<![a-zа-я0-9])e\s*(\d{1,3})\s*-\s*e?\s*(\d{1,3})/,
    /(?:серии|серия|episodes?)\s+(\d{1,3})\s*-\s*(\d{1,3})/,
    /(\d{1,3})\s*-\s*(\d{1,3})\s*(?:серии|серия|эп(?:изод)?)/,
  ];

  for (const pattern of rangePatterns) {
    const match = pattern.exec(titleLower);
    if (!match) {
      continue;
    }
    const startEp = Number.parseInt(match[1], 10);
    const endEp = Number.parseInt(match[2], 10);
    if (startEp <= endEp) {
      return { current: endEp, total: null };
    }
  }

  const singlePatterns = [
    /s\s*\d{1,2}\s*e\s*(\d{1,3})(?!\s*-)/,
    /(?:^|[^a-zа-я0-9])\d{1,2}x(\d{1,3})(?!\s*-)/,
    /(?<![a-zа-я0-9])e\s*(\d{1,3})(?!\s*-)(?![a-zа-я])/,
    /(\d{1,3})\s*(?:серия|серии|эпизод)/,
  ];

  for (const pattern of singlePatterns) {
    const match = pattern.exec(titleLower);
    if (match?.[1]) {
      return { current: Number.parseInt(match[1], 10), total: null };
    }
  }

  return null;
}
