/**
 * Remove BB codes from text
 * Shikimori uses BB codes like [character=123]Name[/character], [b]text[/b], etc.
 */
export function removeBBCodes(text: string): string {
  if (!text) return '';

  let result = text;
  let prevResult = '';

  // Strategy: Process from most specific to least specific
  // This prevents partial matches from interfering with complete matches

  // First pass: Handle paired tags WITH attributes that have content
  // Example: [character=123 name]Content[/character] -> Content
  // Example: [character=123]Content[/character] -> Content
  while (prevResult !== result) {
    prevResult = result;
    result = result.replace(/\[(\w+)=[^\]]+\]([\s\S]*?)\[\/\1\]/g, '$2');
  }

  // Second pass: Handle simple paired tags [tag]content[/tag]
  // Example: [b]text[/b] -> text
  prevResult = '';
  while (prevResult !== result) {
    prevResult = result;
    result = result.replace(/\[(\w+)\]([\s\S]*?)\[\/\1\]/g, '$2');
  }

  // Third pass: Handle unpaired opening tags with ID and name [tag=123 name]
  // Example: [character=241720 каэдэ-сато] -> каэдэ-сато
  // This extracts the name part (everything after "ID ")
  result = result.replace(/\[(\w+)=\d+\s+([^\]]+)\]/g, '$2');

  // Fourth pass: Remove remaining simple attribute tags [tag=value]
  // Example: [size=20] or [character=123] -> (removed completely)
  result = result.replace(/\[(\w+)=[^\]]+\]/g, '');

  // Fifth pass: Remove closing tags and any other remaining tags
  result = result.replace(/\[\/?\w+\]/g, '');

  // Replace escaped newlines with actual newlines
  result = result.replace(/\\n/g, '\n');

  // Clean up multiple consecutive line breaks
  result = result.replace(/\n{3,}/g, '\n\n');

  // Trim whitespace and clean up extra spaces
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}

/**
 * Convert BB codes to HTML
 * Useful for displaying formatted text in HTML
 */
export function bbCodeToHtml(text: string): string {
  if (!text) return '';

  return text
    // Character links - extract just the name
    .replace(/\[character=\d+\](.*?)\[\/character\]/g, '<strong>$1</strong>')
    // Anime links - extract just the name
    .replace(/\[anime=\d+\](.*?)\[\/anime\]/g, '<em>$1</em>')
    // Manga links - extract just the name
    .replace(/\[manga=\d+\](.*?)\[\/manga\]/g, '<em>$1</em>')
    // Bold
    .replace(/\[b\](.*?)\[\/b\]/g, '<strong>$1</strong>')
    // Italic
    .replace(/\[i\](.*?)\[\/i\]/g, '<em>$1</em>')
    // Underline
    .replace(/\[u\](.*?)\[\/u\]/g, '<u>$1</u>')
    // Strikethrough
    .replace(/\[s\](.*?)\[\/s\]/g, '<s>$1</s>')
    // URL
    .replace(/\[url=(.*?)\](.*?)\[\/url\]/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>')
    // Replace \n with <br>
    .replace(/\\n/g, '<br>')
    // Clean up any remaining unclosed tags
    .replace(/\[\/?\w+(?:=[^\]]+)?\]/g, '');
}

/**
 * Remove HTML tags from text
 * Shikimori provides descriptionHtml with HTML markup
 */
export function removeHtmlTags(html: string): string {
  if (!html) return '';

  let result = html;

  // Remove all HTML tags but keep their text content
  // Replace <br>, <br/>, <p> with newlines
  result = result
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n');

  // Remove all other HTML tags
  result = result.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  result = result
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'");

  // Clean up multiple consecutive newlines
  result = result.replace(/\n{3,}/g, '\n\n');

  // Clean up spaces around newlines
  result = result.replace(/[^\S\n]*\n[^\S\n]*/g, '\n');

  // Clean up extra spaces without collapsing preserved newlines
  result = result.replace(/[^\S\n]{2,}/g, ' ');

  return result.trim();
}

/**
 * Truncate text to a specific length
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;

  return text.substring(0, maxLength).trim() + '...';
}
