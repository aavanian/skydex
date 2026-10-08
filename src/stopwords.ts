import isoEnglish from "./vendor/stopwords-iso/en.json";
import isoFrench from "./vendor/stopwords-iso/fr.json";

/**
 * English words stopwords-iso lacks that are just as uninformative in
 * Bluesky posts: conversational filler, opinion markers, "post".
 */
const ENGLISH = `yeah gonna lot lol bad bit coming day days feel guess happen hard hey
hope idea left life love lots nice people person pretty read real sort
start talk time times tomorrow tonight week weeks yesterday folks
totally literally omg wow afaik article post posts absolutely month
months`;

/** French words stopwords-iso lacks, of the same kind. */
const FRENCH = `faire faut déjà c'est j'ai ya aller bonne bonnes bons chose choses grand
grande jamais jour jours mieux moment monde oui petit petite peut-être
savent savoir temps truc trucs vraiment voir veut vois année années
demain hier`;

/** Internet shorthand. */
const SHORTHAND = `imo imho tbh fwiw btw idk iirc ngl`;

/**
 * Dates and counting, in English and French. Month and day names that
 * also name a topic (March, Mars, Sun) are kept.
 */
const CALENDAR_AND_NUMBERS = `january february april june july august september october november
december jan feb mar apr jun jul aug sep oct nov dec monday tuesday
wednesday thursday friday saturday sunday tue thu fri sat janvier
février avril mai juin juillet août septembre octobre novembre décembre
janv févr avr juil déc lundi mardi mercredi jeudi vendredi samedi
dimanche`;

/**
 * Words that name what an account talks about, kept even where a
 * stopword list includes them: stopwords-iso grew out of SEO lists and
 * drops some real topics.
 */
const TOPICS = new Set(
  `computer research web website world information state states état net
trump american bps yoy adj march mars sun`.split(/\s+/),
);

/**
 * English and French words too common to say anything about a topic:
 * the stopwords-iso lists (vendored, see src/vendor/stopwords-iso) plus
 * Skydex's own additions, minus words that name topics.
 */
export const STOPWORDS: ReadonlySet<string> = new Set(
  [
    ...isoEnglish,
    ...isoFrench,
    ...`${ENGLISH} ${FRENCH} ${SHORTHAND} ${CALENDAR_AND_NUMBERS}`.split(/\s+/),
  ].filter((word) => word && !TOPICS.has(word)),
);
