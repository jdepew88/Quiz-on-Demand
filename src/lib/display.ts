/**
 * Presentation helpers. Nothing here affects validation, randomization, or scoring.
 */

/** Short words kept lowercase in a title unless they come first. */
const MINOR_WORDS = new Set([
  "a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "vs", "with",
]);

/**
 * A readable quiz title derived from its file name, since the quiz format has no title field.
 *
 *   "fire-officer-emergency-response.json" -> "Fire Officer Emergency Response"
 *   "history_of_rome.json"                 -> "History of Rome"
 *   "CCNA_practice_v2.json"                -> "CCNA practice v2"   (author's casing kept)
 *
 * All-lowercase names are title-cased; anything with capitals is assumed to be deliberate
 * (acronyms, product names) and only has its separators replaced.
 */
export function quizTitleFromFileName(fileName: string): string {
  const base = fileName
    .replace(/\.json$/i, "")
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (base === "") return "Untitled quiz";

  if (base !== base.toLowerCase()) return base.charAt(0).toUpperCase() + base.slice(1);

  return base
    .split(" ")
    .map((word, index) =>
      index > 0 && MINOR_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}
