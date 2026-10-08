const ENGLISH = `a about above after again against all also am an and any are aren't
as at be because been before being below between both but by can can't
cannot could couldn't did didn't do does doesn't doing don't down during
each even ever every few for from further get gets getting got had hadn't
has hasn't have haven't having he he'd he'll he's her here here's hers
herself him himself his how how's i i'd i'll i'm i've if in into is isn't
it it's its itself just let's like make made many may me might more most
much must mustn't my myself no nor not now of off on once one only or
other ought our ours ourselves out over own really same say said see
shan't she she'd she'll she's should shouldn't so some still such than
that that's the their theirs them themselves then there there's these
they they'd they'll they're they've thing things think this those
through to too two under until up upon us very via want was wasn't way we
we'd we'll we're we've well were weren't what what's when when's where
where's which while who who's whom why why's will with won't would
wouldn't yeah yes yet you you'd you'll you're you've your yours yourself
yourselves going gonna lot lol`;

const FRENCH = `a ai aie aient aies ait alors as au aucun aura aurai auraient aurais
aurait aussi autre aux avaient avais avait avant avec avez aviez avions
avoir avons ayant bon car ce ceci cela celle celles celui ces cet cette
ceux chaque ci comme comment dans de des donc dont du elle elles en encore
est et était étaient étais étant été être eu eux fait faire fais faut font
hors ici il ils je juste la le les leur leurs lui là ma mais me même mes
moi moins mon ne ni nos notre nous on ont ou où par parce pas peu peut
plus pour pourquoi qu quand que quel quelle quelles quels qui sa sans se
ses seulement si sien soi soit sommes son sont sous suis sur ta te tes
toi ton tous tout toute toutes très tu un une vos votre vous vu ça déjà
c'est j'ai il y a ya bien rien fois`;

const GENERIC_ENGLISH = `able actually already always another anyone anything
around ask asked away back bad best better big bit call came come comes
coming day days different done else end enough everybody everyone
everything feel find first found give go goes good great guess happen
hard help hey hope idea keep kind know knew last least left less life
little long look looking looks love lot lots maybe mean means need needs
never new next nice nothing old part people person place point pretty
probably put quite read real right says seem seems seen something
someone sometimes sort start sure take talk tell thanks thank time times
today tomorrow tonight top try trying turn used using use week weeks
whole work working works year years yesterday yet folks totally literally
anyway oh ok okay omg wow afaik ago apparently article available full
large let likely post posts without either makes making absolutely
given sees since among far half high higher low lower month months run`;

const GENERIC_FRENCH = `aller alors autres avoir beaucoup bonne bon bonnes bons chose choses
dire dit enfin faut gens grand grande jamais jour jours merci mieux moment
monde non oui personne petit petite peu peut-être plein plutôt point
premier première sait savent savoir semble souvent temps toujours trop
truc trucs vraiment voir veut vois voilà contre année années aujourd'hui demain
hier`;

/**
 * Dates and counting, in English and French. Month and day names that
 * also name a topic (March, Mars, Sun) are kept.
 */
const CALENDAR_AND_NUMBERS = `january february april june july august september october november
december jan feb mar apr jun jul aug sep sept oct nov dec monday tuesday
wednesday thursday friday saturday sunday mon tue wed thu fri sat
janvier février avril mai juin juillet août septembre octobre novembre
décembre janv févr avr juil déc lundi mardi mercredi jeudi vendredi
samedi dimanche two three four five six seven eight nine ten deux trois
quatre cinq huit neuf dix`;

/**
 * English and French words too common to say anything about a topic:
 * grammatical words plus generic conversational vocabulary.
 */
export const STOPWORDS: ReadonlySet<string> = new Set(
  `${ENGLISH} ${FRENCH} ${GENERIC_ENGLISH} ${GENERIC_FRENCH} ${CALENDAR_AND_NUMBERS}`
    .split(/\s+/)
    .filter(Boolean),
);
