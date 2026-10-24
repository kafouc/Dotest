/**
 * Détection de la langue d'un texte par fréquence de mots courants (sans dépendance, sans appel réseau).
 * Suffisant pour choisir la langue de génération des quiz et des fiches à partir des passages d'un cours.
 */

export type LanguageCode = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl';

export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
  de: 'allemand',
  it: 'italien',
  pt: 'portugais',
  nl: 'néerlandais',
};

const STOP_WORDS: Record<LanguageCode, string[]> = {
  fr: ['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'est', 'que', 'qui', 'dans', 'pour', 'par', 'sur', 'au', 'aux', 'ce', 'cette', 'sont', 'ne', 'pas', 'il', 'elle', 'avec', 'plus', 'son', 'sa', 'ses', 'ou', 'où', 'mais', 'comme', 'être', 'ont', 'en', 'nous', 'vous'],
  en: ['the', 'of', 'and', 'to', 'in', 'is', 'that', 'it', 'for', 'as', 'with', 'was', 'on', 'are', 'by', 'this', 'be', 'at', 'from', 'or', 'an', 'which', 'not', 'have', 'has', 'their', 'can', 'these', 'been', 'its', 'they', 'also'],
  es: ['el', 'la', 'los', 'las', 'de', 'del', 'que', 'y', 'en', 'un', 'una', 'es', 'por', 'con', 'para', 'se', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta', 'entre', 'cuando', 'muy', 'sin', 'sobre'],
  de: ['der', 'die', 'das', 'und', 'ist', 'in', 'den', 'von', 'zu', 'mit', 'sich', 'des', 'auf', 'für', 'nicht', 'ein', 'eine', 'als', 'auch', 'es', 'an', 'werden', 'aus', 'er', 'hat', 'dass', 'sie', 'nach', 'wird', 'bei', 'einer', 'um', 'am', 'sind', 'noch', 'wie'],
  it: ['il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'del', 'della', 'che', 'e', 'è', 'in', 'un', 'una', 'per', 'con', 'non', 'si', 'da', 'come', 'più', 'ma', 'anche', 'sono', 'al', 'alla', 'dei', 'delle', 'nel', 'nella', 'questo', 'questa', 'essere'],
  pt: ['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'que', 'e', 'é', 'em', 'um', 'uma', 'para', 'com', 'não', 'por', 'se', 'mais', 'como', 'mas', 'foi', 'ao', 'ele', 'ela', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'nos', 'já', 'também'],
  nl: ['de', 'het', 'een', 'en', 'van', 'is', 'dat', 'op', 'te', 'in', 'zijn', 'voor', 'met', 'niet', 'aan', 'er', 'ook', 'als', 'bij', 'maar', 'om', 'dit', 'door', 'over', 'ze', 'uit', 'worden', 'deze', 'naar', 'wordt', 'heeft', 'hebben'],
};

// Caractères distinctifs : un bonus léger départage les langues proches (es / pt / it)
const DISTINCTIVE: Partial<Record<LanguageCode, RegExp>> = {
  de: /[äöüß]/g,
  es: /[ñ¿¡]/g,
  pt: /[ãõç]/g,
  fr: /[éèêàçœ]/g,
};

export type LanguageGuess = { code: LanguageCode; name: string; confidence: number };

/** Langue probable du texte ; `fr` par défaut quand le texte est trop court ou ambigu. */
export function detectLanguage(text: string): LanguageGuess {
  const sample = text.slice(0, 20_000).toLowerCase();
  // Mots d'au moins deux lettres (accents latins inclus) : les lettres isolées fausseraient les fréquences
  const words = (sample.match(/[a-zà-öø-ÿœ'’]+/g) ?? []).filter((w) => w.length >= 2);
  if (words.length < 15) return { code: 'fr', name: LANGUAGE_NAMES.fr, confidence: 0 };

  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);

  const scores = (Object.keys(STOP_WORDS) as LanguageCode[]).map((code) => {
    let hits = 0;
    for (const stop of STOP_WORDS[code]) hits += counts.get(stop) ?? 0;
    const accents = DISTINCTIVE[code] ? (sample.match(DISTINCTIVE[code] as RegExp)?.length ?? 0) : 0;
    return { code, score: hits / words.length + Math.min(accents / words.length, 0.05) };
  });
  scores.sort((a, b) => b.score - a.score);

  const [best, second] = scores;
  // Trop peu de mots courants reconnus, ou deux langues à égalité : on garde le français
  if (best.score < 0.08 || best.score - second.score < 0.01) {
    return { code: 'fr', name: LANGUAGE_NAMES.fr, confidence: 0 };
  }
  const confidence = Math.min(1, (best.score - second.score) / best.score + 0.3);
  return { code: best.code, name: LANGUAGE_NAMES[best.code], confidence: Number(confidence.toFixed(2)) };
}

/** Consigne à ajouter aux prompts : la sortie suit la langue du cours (français par défaut). */
export function languageInstruction(language: LanguageGuess): string {
  return `Rédige les questions, les propositions, les justifications et tout le texte de ta réponse en ${language.name}, la langue du cours.`;
}
