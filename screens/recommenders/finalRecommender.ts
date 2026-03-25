import type { DeckKey, RecommendationDoc, TasteProfile } from './types';
import type { Candidate } from './normalizeCandidate';
import { laneFromDeckKey, recommenderProfiles, type RecommenderLane, type RecommenderProfile } from './recommenderProfiles';

const BAD_TITLE_PAT = /(pack|megapack|complete works)/i;
const MAJOR_PUBLISHER_PAT =
  /(penguin|random house|knopf|doubleday|viking|harper|harpercollins|macmillan|st\.? martin|tor|holtzbrinck|simon\s*&?\s*schuster|hachette|little,?\s*brown|orbit|scholastic)/i;
const PRESTIGE_PUBLISHER_PAT =
  /(penguin|random house|knopf|doubleday|viking|harpercollins|macmillan|st\.? martin|tor|simon\s*&?\s*schuster|hachette|little,?\s*brown|orbit)/i;
const SERIES_SIGNAL_PAT =
  /(\bseries\b|\bbook\b\s*(?:#|no\.?|number)?\s*(?:1|one)\b|\bvolume\b\s*(?:1|one)\b|\bvol\.?\s*(?:1|one)\b|\bbook\s*1\b|\b#\s*1\b|\bbook\s*one\b)/i;
const COMPENDIUM_SIGNAL_PAT =
  /(\bomnibus\b|\bbox\s*set\b|\bboxed\s*set\b|\bboxed-set\b|\bcomplete\s+series\b|\bcomplete\s+collection\b|\bcomplete\s+trilogy\b|\bcomplete\s+saga\b|\bcollected\b|\bcollection\b|\banthology\b|\bcompendium\b|\bbundle\b|\bset\b\s*\(\s*\d+\s*books?\s*\))/i;
const WRITING_GUIDE_PAT =
  /\b(writer'?s\s+market|writers?\s+market|how\s+to\s+write|creative\s+writing|writing\s+fiction|novel\s+writing|write\s+a\s+novel|screenwriting|writer'?s\s+guide|publishing|self[-\s]?publishing|query\s+letter|literary\s+agent|manuscript|writers?\s+workshop)\b/i;
const MULTI_BOOK_RANGE_PAT =
  /(\bbooks?\b|\bvolumes?\b|\bvols?\.?\b)\s*(?:#|no\.?|number)?\s*(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s*(?:-|–|—|to|thru|through)\s*(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)/i;
const ANTHOLOGY_COLLECTION_PAT =
  /(\banthology\b|\bcollection\b|\bcollected stories\b|\bselected stories\b|\bshort stories\b|\bcollected essays\b|\bselected essays\b|\bpoems\b|\bselected poems\b|\bselected works\b|\bcomplete works\b|\bbest of\b|\btreasury\b)/i;
const GUIDE_OR_COMPANION_PAT =
  /(\bsummary\b|\bstudy guide\b|\bworkbook\b|\bcompanion\b|\banalysis of\b|\bteacher'?s guide\b|\bdiscussion questions\b|\bunauthorized guide\b)/i;
const AWARD_SIGNAL_PAT =
  /(hugo award|nebula award|locus award|world fantasy award|arthur c\.? clarke award|phil(ip)? k\.? dick award|booker prize|man booker|pulitzer prize|national book award|women'?s prize|edgar award|finalist for the .*award|winner of the .*award|award-winning|award winning|shortlisted for|nominated for)/i;
const NYT_BESTSELLER_PAT = /(new york times bestseller|new york times bestselling|#1 new york times bestseller|nyt bestseller)/i;
const REPUTABLE_AUTHOR_PAT =
  /(ursula k\.? le\s*guin|octavia e\.? butler|margaret atwood|emily st\.? john mandel|blake crouch|gillian flynn|tana french|jeff vandermeer|neal stephenson|william gibson|isaac asimov|frank herbert|dan simmons|ann leckie|nk jemisin|n\.k\. jemisin|mary doria russell|elizabeth moon|michael swanwick|china mi[eé]ville|ted chiang|kazuo ishiguro|donna tartt|cormac mccarthy|colson whitehead|suzanne collins|andy weir|george saunders|david mitchell|celeste ng|hanya yanagihara|hilary mantel|barbara kingsolver|ann patchett|patricia highsmith|shirley jackson|ray bradbury|philip k\.? dick|arthur c\.? clarke|robert a\.? heinlein|joe abercrombie|naomi novik|robin hobb|seanan mcguire|t\.? kingfisher|c\.? j\.? tudor|paul tremblay|silvia moreno-garcia|alex michaelides|madeline miller|ann cleeves|louise penny|r\.f\. kuang|emily henry|taylor jenkins reid|michael connelly|stephen king)/i;
const TITLE_SPAM_GENRE_PAT =
  /\b(science fiction novel|sci[-\s]?fi novel|fantasy novel|dark fantasy|romance novel|dark romance|paranormal romance|urban fantasy|thriller novel|psychological thriller|horror novel|historical fiction novel|christian historical fiction novel|climate fiction novel|post[-\s]?apocalyptic(?: robot)? science fiction novel|dystopian novel)\b/i;
const TITLE_SPAM_PROMO_PAT =
  /\b(a stand[-\s]?alone novel|standalone novel|a [a-z][a-z' -]{0,40} novel|book\s*[#:]?\s*\d+|volume\s*\d+|part\s*\d+|the final reckoning|complete saga|epic novel|page[-\s]?turning|must[-\s]?read)\b/i;
const TITLE_SPAM_SEPARATOR_PAT = /(?:\.|\||-|:)\s*(?:a|an|the)?\s*[a-z][a-z' -]{0,60}\b(?:novel|fiction|thriller|romance|saga|book)\b/i;
const MEDIA_TIE_IN_PAT =
  /(official noveli[sz]ation|noveli[sz]ed adaptation|motion picture tie[-\s]?in|movie tie[-\s]?in|major motion picture|now a major motion picture|soon to be a major motion picture|soon to be a motion picture|now a netflix (?:film|series)|netflix series tie[-\s]?in|tv tie[-\s]?in|television tie[-\s]?in|based on the (?:hit|major)?\s*(?:film|movie|motion picture|tv series|television series|show|video game)|inspired by the (?:film|movie|series|show|game)|originally published as a tie[-\s]?in|official companion to the (?:series|show|film|movie|game)|from the world of|set in the world of|an original novel based on|the official prequel|the official sequel|the official companion novel|screen to page|from the hit (?:series|show|film|movie|game)|star wars|star trek|doctor who|halo|warhammer|warhammer 40,?000|world of warcraft|assassin'?s creed|minecraft|five nights at freddy'?s|fnaf|alien\b|predator\b|terminator\b|transformers\b|pacific rim|mass effect|resident evil|dungeons?\s*&\s*dragons|d&d\b|forgotten realms|dragonlance|minecraft legends)/i;
const MEDIA_TIE_IN_SOFT_PAT = /(media tie[-\s]?in|tie[-\s]?in edition|film edition|movie edition|tv edition|series tie[-\s]?in|franchise novel|licensed novel|expanded universe|movie novel|television novel|game novel|officially licensed|official (?:film|tv|game|franchise) novel)/i;
const MEDIA_TIE_IN_CATEGORY_PAT = /(media tie[-\s]?in|movie noveli[sz]ations?|television adaptations?|video game books?|licensed characters?|film tie[-\s]?in)/i;

const DOC_TASTE_SIGNAL_PATTERNS = {
  humorous: /\b(humor|humorous|funny|comic|comedic|satire|satirical|witty|laugh[-\s]?out[-\s]?loud)\b/i,
  warm: /\b(warm|heartwarming|hopeful|uplifting|tender|empathetic|gentle|kindness|life[-\s]?affirming)\b/i,
  character: /\b(character[-\s]?driven|character[-\s]?focused|relationship[-\s]?driven|interpersonal|family saga|coming[-\s]?of[-\s]?age)\b/i,
  dark: /\b(dark|bleak|grim|haunting|disturbing|macabre|gothic|tragic|brooding)\b/i,
  complex: /\b(complex|layered|intricate|nuanced|multi[-\s]?layered|dense|challenging)\b/i,
  idea: /\b(idea[-\s]?driven|thought[-\s]?provoking|philosophical|conceptual|big ideas?|speculative|intellectual)\b/i,
  romantic: /\b(romance|romantic|love story|relationship fiction)\b/i,
  adventurous: /\b(adventure|adventurous|quest|journey|expedition|survival|action[-\s]?packed|swashbuckling)\b/i,
  cozy: /\b(cozy|cosy|comfort read|small town|found family|gentle mystery)\b/i,
  mysterious: /\b(mystery|mysterious|investigation|detective|whodunit|suspense)\b/i,
  hopeful: /\b(hopeful|uplifting|optimistic|redemptive|inspiring)\b/i,
  tense: /\b(tense|thrilling|suspenseful|high[-\s]?stakes|gripping|edge[-\s]?of[-\s]?your[-\s]?seat)\b/i,
  literary: /\b(literary|lyrical|elegant prose|award[-\s]?winning|booker|pulitzer)\b/i,
  fast: /\b(page[-\s]?turner|fast[-\s]?paced|propulsive|unputdownable|quick read)\b/i,
} as const;

const TASTE_KEY_ALIASES = {
  humorous: /(humou?r|funny|comic|comedic|satire|witty)/i,
  warm: /(warm|heartwarm|uplift|tender|gentle|kind)/i,
  character: /(character|relationship|people[-_\s]?focused|interpersonal)/i,
  dark: /(dark|bleak|grim|gothic|tragic|brood)/i,
  complex: /(complex|layered|intricate|nuanced|dense|challenging)/i,
  idea: /(idea|concept|philosoph|thought|speculative|intellectual|theme)/i,
  romantic: /(romance|romantic|love)/i,
  adventurous: /(adventure|quest|journey|survival|action)/i,
  cozy: /(cozy|cosy|comfort|found family|small town)/i,
  mysterious: /(mystery|mysterious|detective|investigat|whodunit|suspense)/i,
  hopeful: /(hopeful|optimistic|uplift|redemptive|inspiring)/i,
  tense: /(tense|thrill|suspenseful|high[-_\s]?stakes|gripping)/i,
  literary: /(literary|lyric|prose|booker|pulitzer|award)/i,
  fast: /(fast|pace|page[-_\s]?turner|propulsive|quick)/i,
} as const;

type TasteSignalKey = keyof typeof DOC_TASTE_SIGNAL_PATTERNS;

type QueryLadderTerm = {
  term: string;
  rung: number;
  weight: number;
  isAnchor: boolean;
  isFallback?: boolean;
};

type QueryAlignmentScore = {
  score: number;
  multiplier: number;
  coverageScore: number;
  anchorScore: number;
  strongestScore: number;
  matchedTerms: number;
  matchedAnchorTerms: number;
  totalAnchorTerms: number;
  anchorCoverage: number;
  matchedNonFallbackTerms: number;
  hasAnchorMatch: boolean;
  hasZeroAnchorMatch: boolean;
  fallbackOnly: boolean;
  mismatchPenalty: number;
};

const QUERY_TOKEN_STOPWORDS = new Set([
  'a', 'an', 'and', 'any', 'author', 'authors', 'best', 'book', 'books', 'fiction', 'for', 'from', 'in', 'of', 'or',
  'read', 'reads', 'reader', 'readers', 'series', 'story', 'stories', 'the', 'to', 'with', 'without', 'novel',
]);
const DECISIVE_GENRE_ANCHOR_PAT = /(fantasy|science fiction|sci fi|sci-fi|thriller|mystery|horror|romance|historical|literary|dystopian|post apocalyptic|speculative|cozy|crime|detective|adventure|drama|paranormal)/i;
const SCIENCE_FICTION_PAT = /\b(science fiction|sci fi|sci-fi|speculative|space opera|cyberpunk|dystopian|post apocalyptic|time travel|alien|robot|android)\b/i;
const FANTASY_PAT = /\b(fantasy|epic fantasy|high fantasy|urban fantasy|dark fantasy|magic|wizard|sorcery|mythology|mythic|faerie|fairy tale)\b/i;
const THRILLER_PAT = /\b(thriller|suspense|psychological thriller|crime thriller|espionage|page turner|high stakes)\b/i;
const HORROR_PAT = /\b(horror|supernatural horror|gothic horror|haunted|ghost story|occult|terror)\b/i;
const PARANORMAL_PAT = /\b(paranormal|supernatural|ghost|haunting|occult|psychic|vampire|werewolf)\b/i;
const HISTORICAL_PAT = /\b(historical|historical fiction|period piece|victorian|wwi|wwii|civil war|regency|medieval)\b/i;
const DRAMA_PAT = /\b(drama|family saga|literary fiction|relationship fiction|character driven)\b/i;
const MYSTERY_PAT = /\b(mystery|detective|whodunit|investigation|crime fiction)\b/i;
const ROMANCE_PAT = /\b(romance|love story|romantic)\b/i;
const COMEDY_PAT = /\b(comedy|comic|comedic|humor|humorous|satire|witty)\b/i;
const JUVENILE_PAT = /\b(children|childrens|children s|juvenile|middle grade|young readers|scholastic|ages? 8|ages? 9|ages? 10|ages? 11|ages? 12|step into reading)\b/i;

export type FinalRecommenderOptions = {
  lane?: RecommenderLane;
  deckKey?: DeckKey;
  tasteProfile?: TasteProfile;
  profileOverride?: Partial<RecommenderProfile>;
  priorRecommendedIds?: string[];
  priorRecommendedKeys?: string[];
  priorAuthors?: string[];
  priorSeriesKeys?: string[];
  priorRejectedIds?: string[];
  priorRejectedKeys?: string[];
};

function normalizeText(value: any): string {
  return String(value || '').trim();
}

function logFinalPassStage(stage: string, candidates: Candidate[], extra: Record<string, any> = {}): void {
  try {
    const countsBySource = (Array.isArray(candidates) ? candidates : []).reduce(
      (acc, candidate) => {
        const key = candidate?.source || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log('[NovelIdeas][finalRecommender][stage]', {
      stage,
      count: Array.isArray(candidates) ? candidates.length : 0,
      countsBySource,
      ...extra,
    });
  } catch {}
}


function haystack(candidate: Candidate): string {
  return [
    candidate.title,
    candidate.subtitle || '',
    candidate.description || '',
    candidate.publisher || '',
    ...candidate.subjects,
    ...candidate.genres,
  ]
    .filter(Boolean)
    .join(' | ');
}

function normalizeKey(value: any): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function identityKey(candidate: Candidate): string {
  const title = normalizeKey(candidate.title);
  const author = normalizeKey(candidate.author);
  if (title && author) return `${title}|${author}`;
  return candidate.id;
}

function metadataSignals(candidate: Candidate): number {
  let score = 0;
  if (candidate.title) score += 2;
  if (candidate.subtitle) score += 1;
  if (candidate.author && candidate.author !== 'Unknown') score += 2;
  if (candidate.publisher) score += 2;
  if (candidate.description) score += 2;
  if (candidate.hasCover) score += 1;
  if (candidate.publicationYear) score += 1;
  if (candidate.subjects.length) score += 2;
  if (candidate.ratingCount > 0) score += 2;
  if (candidate.averageRating > 0) score += 1;
  return score;
}

function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const byKey = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = identityKey(candidate);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }
    const existingScore = metadataSignals(existing);
    const nextScore = metadataSignals(candidate);
    byKey.set(key, nextScore > existingScore ? candidate : existing);
  }
  return Array.from(byKey.values());
}

function looksLikeFiction(candidate: Candidate): boolean {
  const text = haystack(candidate);
  const fictionSignal =
    /\bfiction\b/i.test(text) ||
    /\b(novel|novella|short story|story collection|literary fiction|historical fiction|crime fiction|speculative fiction|relationship fiction)\b/i.test(text);

  const nonfictionSignal =
    /\b(nonfiction|non-fiction|biography|memoir|autobiography|essays?|essay collection|letters|journalism|history|reference|dictionary|thesaurus|encyclopedia|handbook|manual|study guide|workbook|analysis|criticism|commentary|textbook|curriculum|research|academic|case studies|self-help|guidebook)\b/i.test(text);

  if (nonfictionSignal && !fictionSignal) return false;
  if (fictionSignal) return true;

  return candidate.subjects.length === 0 && !!candidate.description;
}

function scoreAwardSignal(candidate: Candidate): number {
  const text = haystack(candidate);
  if (!AWARD_SIGNAL_PAT.test(text)) return 0;
  if (/\b(winner of|award-winning|award winning|hugo award|nebula award|booker prize|pulitzer prize|national book award|women'?s prize|edgar award)\b/i.test(text)) {
    return 0.9;
  }
  if (/\b(finalist|shortlisted|nominated)\b/i.test(text)) return 0.45;
  return 0.35;
}

function scoreNYTBestsellerSignal(candidate: Candidate): number {
  return NYT_BESTSELLER_PAT.test(haystack(candidate)) ? 0.65 : 0;
}

function scoreAuthorReputationSignal(candidate: Candidate): number {
  return REPUTABLE_AUTHOR_PAT.test(candidate.author) ? 0.75 : 0;
}

function hasSeriesSignals(candidate: Candidate): boolean {
  return SERIES_SIGNAL_PAT.test([candidate.title, candidate.subtitle || '', candidate.description || ''].join(' | '));
}

function scoreRecencyBoost(candidate: Candidate): number {
  if (!candidate.publicationYear) return 0;
  const currentYear = new Date().getFullYear();
  const age = currentYear - candidate.publicationYear;
  if (age <= 3) return 0.32;
  if (age <= 10) return 0.22;
  if (age <= 20) return 0.12;
  if (age <= 40) return 0;
  if (age <= 60) return -0.08;
  return -0.14;
}

function scoreAnthologyCollectionRisk(candidate: Candidate): { penalty: number; hardFilter: boolean } {
  const text = haystack(candidate);
  let signals = 0;
  let strongSignals = 0;

  if (GUIDE_OR_COMPANION_PAT.test(text)) return { penalty: 1, hardFilter: true };
  if (COMPENDIUM_SIGNAL_PAT.test(text)) {
    signals += 1;
    strongSignals += 1;
  }
  if (ANTHOLOGY_COLLECTION_PAT.test(text)) {
    signals += 1;
    strongSignals += 1;
  }
  if (MULTI_BOOK_RANGE_PAT.test(text)) {
    signals += 1;
    strongSignals += 1;
  }
  if (/\bedited by\b/i.test(text)) signals += 1;
  if (candidate.authors.length >= 4) signals += 1;

  const hardFilter = (strongSignals >= 2 && candidate.authors.length >= 2) || /\b(box(?:ed)? set|omnibus|complete series|complete collection|complete trilogy|complete saga)\b/i.test(text);
  if (hardFilter) return { penalty: 1, hardFilter: true };
  if (signals >= 3) return { penalty: 0.35, hardFilter: false };
  if (signals === 2) return { penalty: 0.18, hardFilter: false };
  if (signals === 1) return { penalty: 0.08, hardFilter: false };
  return { penalty: 0, hardFilter: false };
}

function looksLikeWritingGuide(candidate: Candidate): boolean {
  return WRITING_GUIDE_PAT.test(haystack(candidate));
}

function scoreMediaTieInRisk(candidate: Candidate, lane: RecommenderLane): number {
  if (lane !== 'adult') return 0;
  const text = haystack(candidate);
  let penalty = 0;
  let signals = 0;
  if (MEDIA_TIE_IN_PAT.test(text)) {
    penalty += 0.34;
    signals += 2;
  }
  if (MEDIA_TIE_IN_SOFT_PAT.test(text)) {
    penalty += 0.18;
    signals += 1;
  }
  if (MEDIA_TIE_IN_CATEGORY_PAT.test(text)) {
    penalty += 0.18;
    signals += 1;
  }

  const strongTrustSignal =
    PRESTIGE_PUBLISHER_PAT.test(candidate.publisher) ||
    scoreAwardSignal(candidate) > 0 ||
    scoreNYTBestsellerSignal(candidate) > 0 ||
    scoreAuthorReputationSignal(candidate) > 0 ||
    candidate.ratingCount >= 120 ||
    candidate.editionCount >= 20;

  if (strongTrustSignal) penalty *= 0.55;
  else if (MAJOR_PUBLISHER_PAT.test(candidate.publisher) || candidate.ratingCount >= 30 || candidate.editionCount >= 10) penalty *= 0.78;
  else if (candidate.source === 'googleBooks' && metadataSignals(candidate) <= 9 && !MAJOR_PUBLISHER_PAT.test(candidate.publisher)) penalty *= 1.08;

  if (signals >= 2 && !strongTrustSignal && candidate.ratingCount <= 8 && candidate.editionCount <= 4) penalty += 0.08;
  return Math.max(0, Math.min(0.6, penalty));
}

function scoreTitleSpamPenalty(candidate: Candidate, lane: RecommenderLane): number {
  if (lane !== 'adult') return 0;
  const title = candidate.title;
  if (!title) return 0;
  const subtitle = candidate.subtitle || '';
  const titleWords = title.match(/[A-Za-z0-9']+/g) || [];
  const subtitleWords = subtitle.match(/[A-Za-z0-9']+/g) || [];
  const lowerTitleWords = titleWords.map((word) => word.toLowerCase());
  let penalty = 0;
  let signals = 0;

  if (titleWords.length >= 12) { penalty += 0.12; signals += 1; }
  if (titleWords.length >= 16) { penalty += 0.1; signals += 1; }
  if (TITLE_SPAM_GENRE_PAT.test(title) || TITLE_SPAM_GENRE_PAT.test(subtitle)) { penalty += 0.18; signals += 1; }
  if (TITLE_SPAM_PROMO_PAT.test(title) || TITLE_SPAM_PROMO_PAT.test(subtitle)) { penalty += 0.12; signals += 1; }
  if (TITLE_SPAM_SEPARATOR_PAT.test(title) || TITLE_SPAM_SEPARATOR_PAT.test(subtitle)) { penalty += 0.1; signals += 1; }

  const repeatedWords = new Set<string>();
  for (let i = 0; i < lowerTitleWords.length; i += 1) {
    const word = lowerTitleWords[i];
    if (word.length >= 4 && lowerTitleWords.indexOf(word) !== i) repeatedWords.add(word);
  }
  if (repeatedWords.size >= 1) { penalty += 0.08; signals += 1; }
  if (subtitleWords.length >= 5 && /\b(novel|fiction|romance|fantasy|thriller|mystery|sci[-\s]?fi|science fiction|historical|paranormal|post[-\s]?apocalyptic|dystopian)\b/i.test(subtitle)) {
    penalty += 0.1;
    signals += 1;
  }

  const strongTrustSignal =
    PRESTIGE_PUBLISHER_PAT.test(candidate.publisher) ||
    scoreAwardSignal(candidate) > 0 ||
    scoreNYTBestsellerSignal(candidate) > 0 ||
    scoreAuthorReputationSignal(candidate) > 0 ||
    candidate.ratingCount >= 80 ||
    candidate.editionCount >= 18;

  if (strongTrustSignal) penalty *= 0.45;
  else if (MAJOR_PUBLISHER_PAT.test(candidate.publisher) || candidate.ratingCount >= 20 || candidate.editionCount >= 8) penalty *= 0.7;
  else if (candidate.source === 'googleBooks' && metadataSignals(candidate) <= 9 && !MAJOR_PUBLISHER_PAT.test(candidate.publisher)) penalty *= 1.15;
  if (signals >= 3 && !strongTrustSignal && candidate.ratingCount <= 5 && candidate.editionCount <= 3) penalty += 0.08;
  return Math.max(0, Math.min(0.55, penalty));
}

function scoreCoverQualityPenalty(candidate: Candidate, lane: RecommenderLane): number {
  if (lane !== 'adult') return 0;
  if (!candidate.hasCover) {
    if (candidate.source === 'googleBooks' && candidate.ratingCount <= 5 && candidate.editionCount <= 3 && metadataSignals(candidate) <= 10 && !MAJOR_PUBLISHER_PAT.test(candidate.publisher)) return 0.95;
    if (candidate.ratingCount <= 10 && candidate.averageRating <= 0 && candidate.editionCount <= 3 && !PRESTIGE_PUBLISHER_PAT.test(candidate.publisher)) return 0.72;
    return 0.5;
  }
  return 0;
}

function looksJuvenileOrClassicDrift(candidate: Candidate, lane: RecommenderLane): boolean {
  if (lane !== 'adult') return false;
  const text = haystack(candidate);
  const juvenileSignals =
    /\b(children|childrens|children's|juvenile|young readers|classic starts|oxford bookworms|step into reading|scholastic reader|i can read)\b/i.test(text) ||
    /\b(a little princess|daddy-long-legs|dorothy and the wizard in oz|anne of the island|anne of windy poplars)\b/i.test(candidate.title);
  const classicSignals = /\b(classic|unabridged|illustrated|collector'?s edition|throwback)\b/i.test(text);
  const veryOld = candidate.publicationYear > 0 && candidate.publicationYear < 1950;
  return juvenileSignals || (classicSignals && veryOld) || veryOld;
}

function looksLowSignalOrObscure(candidate: Candidate, lane: RecommenderLane): boolean {
  if (lane !== 'adult') return false;
  const selfPubOrTinyImprint = /(independently published|self[- ]published|createspace|kindle direct publishing|\bkdp\b|amazon digital services|amazon kdp|lulu\.com|lulu press|blurb|smashwords|draft2digital|authorhouse|xlibris|iuniverse|bookbaby|notion press|balboa press|trafford|whitmore publishing)/i.test(candidate.publisher);
  const weakPublisherSignal = !MAJOR_PUBLISHER_PAT.test(candidate.publisher) && (!candidate.publisher || candidate.publisher.length < 3 || /(press|publishing|publications|books|book|media|studios|house|imprint)/i.test(candidate.publisher));
  const noAudienceSignal = metadataSignals(candidate) <= 8;
  const noPopularitySignal = candidate.ratingCount <= 1 && candidate.averageRating <= 0;
  const ultraThin = metadataSignals(candidate) <= 6;
  if (selfPubOrTinyImprint) return true;
  if (candidate.source === 'googleBooks' && noPopularitySignal && weakPublisherSignal && noAudienceSignal) return true;
  if (ultraThin && !MAJOR_PUBLISHER_PAT.test(candidate.publisher) && candidate.ratingCount === 0) return true;
  return false;
}

function collectNumericTasteSignals(value: any, path = '', out: Array<{ path: string; value: number }> = []): Array<{ path: string; value: number }> {
  if (value == null) return out;
  if (typeof value === 'number' && Number.isFinite(value)) {
    out.push({ path, value });
    return out;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) collectNumericTasteSignals(value[i], `${path}[${i}]`, out);
    return out;
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      collectNumericTasteSignals(nested, path ? `${path}.${key}` : key, out);
    }
  }
  return out;
}

function normalizeTastePreference(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  if (raw > 1) return Math.min(raw / 5, 1);
  if (raw < -1) return Math.max(raw / 5, -1);
  return raw;
}

function getTastePreferenceForKey(taste: TasteProfile | undefined, key: TasteSignalKey): number {
  if (!taste) return 0;
  const signals = collectNumericTasteSignals(taste as any);
  let total = 0;
  let matched = 0;
  for (const signal of signals) {
    if (!TASTE_KEY_ALIASES[key].test(signal.path)) continue;
    total += normalizeTastePreference(signal.value);
    matched += 1;
  }
  return matched ? Math.max(-1, Math.min(1, total / matched)) : 0;
}

function scoreDocTasteSignal(candidate: Candidate, key: TasteSignalKey): number {
  return DOC_TASTE_SIGNAL_PATTERNS[key].test(haystack(candidate)) ? 1 : 0;
}

function scoreTasteMatch(candidate: Candidate, taste?: TasteProfile): number {
  if (!taste) return 0;
  const keys = Object.keys(DOC_TASTE_SIGNAL_PATTERNS) as TasteSignalKey[];
  let total = 0;
  let matched = 0;
  for (const key of keys) {
    const pref = getTastePreferenceForKey(taste, key);
    if (Math.abs(pref) < 0.12) continue;
    const docSignal = scoreDocTasteSignal(candidate, key);
    if (!docSignal) continue;
    total += pref * docSignal;
    matched += 1;
  }
  if (!matched) return 0;
  return Math.max(-1.1, Math.min(1.1, (total / matched) * 1.1));
}

function scoreSessionTagMatch(candidate: Candidate, queryLadder: QueryLadderTerm[]): number {
  if (!queryLadder.length) return 0;

  const text = ` ${normalizeKey(haystack(candidate))} `;
  let score = 0;
  let matched = 0;

  for (const term of queryLadder) {
    const pattern = new RegExp(`\b${escapeRegExp(term.term).replace(/ /g, '\s+')}\b`, 'i');
    if (!pattern.test(text)) continue;

    matched += 1;

    if (term.isAnchor) score += 2.2;
    else if (!term.isFallback) score += 1.2;
    else score += 0.2;
  }

  if (matched === 0) return -0.5;

  return Math.min(5, score);
}

function scorePopularity(candidate: Candidate): number {
  return Math.log10(candidate.ratingCount + 1) * ((candidate.averageRating > 0 ? candidate.averageRating : 4) / 5) * 4.75;
}

function scoreEditionBoost(candidate: Candidate): number {
  return Math.log10(candidate.editionCount + 1) * 0.45;
}

function scorePublisherBoost(candidate: Candidate): number {
  if (!candidate.publisher) return 0;
  if (PRESTIGE_PUBLISHER_PAT.test(candidate.publisher)) return 0.9;
  if (MAJOR_PUBLISHER_PAT.test(candidate.publisher)) return 0.55;
  return 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenizeQueryText(value: string): string[] {
  const normalized = normalizeKey(value);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !QUERY_TOKEN_STOPWORDS.has(token));
}

function extractMeaningfulPhrases(value: string): string[] {
  const normalized = normalizeKey(value);
  if (!normalized) return [];
  const parts = normalized
    .split(/\b(?:and|or|with|without|for|from|like|about|plus|meets?)\b/g)
    .map((part) => part.trim())
    .filter(Boolean);

  return Array.from(new Set(
    parts
      .map((part) => part.replace(/\s+/g, ' ').trim())
      .filter((part) => part.length >= 7)
      .filter((part) => part.split(' ').length >= 2)
  ));
}

function buildQueryLadder(candidates: Candidate[]): QueryLadderTerm[] {
  const byTerm = new Map<string, QueryLadderTerm>();

  for (const candidate of candidates) {
    const rung = Number.isFinite(Number(candidate.queryRung)) ? Math.max(0, Number(candidate.queryRung)) : 0;
    const rungWeight =
      rung == 0 ? 3.2 :
      rung == 1 ? 2.15 :
      rung == 2 ? 1.35 :
      rung == 3 ? 0.9 :
      0.28;

const sourceTerms = [
  ...(Array.isArray(candidate.queryTerms) ? candidate.queryTerms : []),
  ...tokenizeQueryText(candidate.queryText || ''),
  ...extractMeaningfulPhrases(candidate.queryText || ''),
];

    const terms = Array.from(new Set(sourceTerms));

    for (const term of terms) {
      const normalizedTerm = normalizeKey(term);
      if (!normalizedTerm || normalizedTerm.length < 3) continue;
      const isFallback = normalizedTerm === 'fiction';
      const isAnchor = !isFallback && (
        DECISIVE_GENRE_ANCHOR_PAT.test(normalizedTerm) ||
        candidate.subjects.some((subject) => normalizeKey(subject) === normalizedTerm)
      );
      const weight = rungWeight * (isAnchor ? 1.9 : normalizedTerm.includes(' ') ? 1.25 : 1) * (isFallback ? 0.2 : 1);
      const existing = byTerm.get(normalizedTerm);
      if (!existing || weight > existing.weight) {
        byTerm.set(normalizedTerm, { term: normalizedTerm, rung, weight, isAnchor, isFallback });
      }
    }
  }

  return Array.from(byTerm.values()).sort((left, right) => {
    if (right.weight !== left.weight) return right.weight - left.weight;
    if (left.rung !== right.rung) return left.rung - right.rung;
    return left.term.localeCompare(right.term);
  });
}

function buildRelaxedLadders(queryLadder: QueryLadderTerm[]): QueryLadderTerm[][] {
  if (!queryLadder.length) return [];
  const ladders: QueryLadderTerm[][] = [];
  let active = [...queryLadder];
  const seen = new Set<string>();

  while (active.length) {
    const key = active.map((term) => term.term).join('|');
    if (!seen.has(key)) {
      ladders.push(active);
      seen.add(key);
    }

    const anchors = active.filter((term) => term.isAnchor && !term.isFallback);
    const nonFallback = active.filter((term) => !term.isFallback);
    if (nonFallback.length <= Math.max(1, anchors.length)) break;

    let dropIndex = -1;
    let weakestWeight = Infinity;
    for (let i = active.length - 1; i >= 0; i -= 1) {
      const term = active[i];
      if (term.isFallback || term.isAnchor) continue;
      if (term.weight <= weakestWeight) {
        weakestWeight = term.weight;
        dropIndex = i;
      }
    }

    if (dropIndex >= 0) {
      active = active.filter((_, index) => index !== dropIndex);
      continue;
    }

    const fallbackIndex = active.findIndex((term) => term.isFallback);
    if (fallbackIndex >= 0) {
      active = active.filter((_, index) => index !== fallbackIndex);
      continue;
    }

    break;
  }

  return ladders;
}

function getRequestedAnchorFlags(queryLadder: QueryLadderTerm[]) {
  const anchorTerms = queryLadder.filter((term) => term.isAnchor).map((term) => term.term);
  return {
    realistic: anchorTerms.some((term) => /\brealistic fiction\b/.test(term)),
    scienceFiction: anchorTerms.some((term) => SCIENCE_FICTION_PAT.test(term)),
    fantasy: anchorTerms.some((term) => FANTASY_PAT.test(term)),
    thriller: anchorTerms.some((term) => THRILLER_PAT.test(term)),
    horror: anchorTerms.some((term) => HORROR_PAT.test(term)),
    paranormal: anchorTerms.some((term) => PARANORMAL_PAT.test(term)),
    historical: anchorTerms.some((term) => HISTORICAL_PAT.test(term)),
    drama: anchorTerms.some((term) => DRAMA_PAT.test(term)),
    mystery: anchorTerms.some((term) => MYSTERY_PAT.test(term)),
    crime: anchorTerms.some((term) => /\b(crime|crime fiction|crime thriller)\b/i.test(term)),
    romance: anchorTerms.some((term) => ROMANCE_PAT.test(term)),
  };
}

function laneAwareFallbackPenalty(
  candidate: Candidate,
  flags: ReturnType<typeof getRequestedAnchorFlags>,
  totalAnchorTerms: number,
): number {
  let penalty = 0.75;
  const text = haystack(candidate);
  const hasStrongNarrativeSignals = /\b(novel|fiction|literary|mystery|thriller|horror|fantasy|science fiction|historical fiction|crime fiction|story collection|novella)\b/i.test(text);
  const hasReferenceSignals = /\b(biography|memoir|autobiography|dictionary|thesaurus|encyclopedia|reference|handbook|manual|study guide|workbook|analysis|criticism|textbook|research|academic)\b/i.test(text);
  const requestedHighIntent =
    flags.scienceFiction || flags.fantasy || flags.thriller || flags.horror || flags.paranormal ||
    flags.historical || flags.drama || flags.mystery || flags.romance || flags.realistic;

  if (requestedHighIntent) penalty += 1.6;
  if (totalAnchorTerms === 0) penalty += 0.8;
  if (!hasStrongNarrativeSignals) penalty += 0.85;
  if (hasReferenceSignals) penalty += 1.75;
  return penalty;
}

function scoreQueryLadderAlignment(candidate: Candidate, queryLadder: QueryLadderTerm[]): QueryAlignmentScore {
  if (!queryLadder.length) {
    return {
      score: 0,
      multiplier: 1,
      coverageScore: 0,
      anchorScore: 0,
      strongestScore: 0,
      matchedTerms: 0,
      matchedAnchorTerms: 0,
      totalAnchorTerms: 0,
      anchorCoverage: 0,
      matchedNonFallbackTerms: 0,
      hasAnchorMatch: false,
      hasZeroAnchorMatch: false,
      fallbackOnly: false,
      mismatchPenalty: 0,
    };
  }

  const text = ` ${normalizeKey(haystack(candidate))} `;
  let matchedWeight = 0;
  let anchorWeight = 0;
  let strongestMatchedWeight = 0;
  let matchedTerms = 0;
  let matchedAnchorTerms = 0;
  let matchedNonFallbackTerms = 0;

  const anchorTerms = queryLadder.filter((term) => term.isAnchor && !term.isFallback);
  const candidateGenreText = normalizeKey([
    ...candidate.subjects,
    ...candidate.genres,
    candidate.title,
    candidate.subtitle || '',
  ].join(' | '));
  const candidateTextForTerms = text;
  const candidateTextForAnchors = ` ${candidateGenreText} `;

  for (const queryTerm of queryLadder) {
    const termPattern = escapeRegExp(queryTerm.term).replace(/ /g, '\\s+');
    const pat = new RegExp(`\\b${termPattern}\\b`, 'i');
    const matches = queryTerm.isAnchor ? pat.test(candidateTextForAnchors) : pat.test(candidateTextForTerms);
    if (!matches) continue;
    matchedWeight += queryTerm.weight;
    matchedTerms += 1;
    if (!queryTerm.isFallback) matchedNonFallbackTerms += 1;
    if (queryTerm.isAnchor) {
      anchorWeight += queryTerm.weight;
      matchedAnchorTerms += 1;
    }
    if (queryTerm.weight > strongestMatchedWeight) strongestMatchedWeight = queryTerm.weight;
  }

  const totalWeight = queryLadder.reduce((sum, queryTerm) => sum + queryTerm.weight, 0);
  const totalAnchorWeight = queryLadder.reduce((sum, queryTerm) => sum + (queryTerm.isAnchor ? queryTerm.weight : 0), 0);
  const totalAnchorTerms = anchorTerms.length;
  const coverageScore = totalWeight > 0 ? matchedWeight / totalWeight : 0;
  const anchorScore = totalAnchorWeight > 0 ? anchorWeight / totalAnchorWeight : 0;
  const strongestScore = queryLadder[0]?.weight ? strongestMatchedWeight / queryLadder[0].weight : 0;
  const anchorCoverage = totalAnchorTerms > 0 ? matchedAnchorTerms / totalAnchorTerms : 0;
  const hasAnchorMatch = matchedAnchorTerms > 0;
  const hasZeroAnchorMatch = totalAnchorTerms > 0 && matchedAnchorTerms === 0;
  const fallbackOnly = matchedTerms > 0 && matchedNonFallbackTerms === 0;

  const flags = getRequestedAnchorFlags(queryLadder);
  const hasFantasy = FANTASY_PAT.test(candidateGenreText);
  const hasScienceFiction = SCIENCE_FICTION_PAT.test(candidateGenreText);
  const hasThriller = THRILLER_PAT.test(candidateGenreText);
  const hasHorror = HORROR_PAT.test(candidateGenreText);
  const hasParanormal = PARANORMAL_PAT.test(candidateGenreText);
  const hasHistorical = HISTORICAL_PAT.test(candidateGenreText);
  const hasDrama = DRAMA_PAT.test(candidateGenreText);
  const hasMystery = MYSTERY_PAT.test(candidateGenreText);
  const hasRomance = ROMANCE_PAT.test(candidateGenreText);
  const hasComedy = COMEDY_PAT.test(candidateGenreText);
  const hasJuvenile = JUVENILE_PAT.test(candidateGenreText);

  let mismatchPenalty = 0;
  if (flags.realistic) {
    if (!hasAnchorMatch) mismatchPenalty += 1.4;
    if (hasFantasy) mismatchPenalty += 2.4;
    if (hasScienceFiction) mismatchPenalty += 1.35;
    if (hasJuvenile) mismatchPenalty += 1.1;
  }
  if (flags.scienceFiction && !hasScienceFiction) mismatchPenalty += 3.0;
  if (flags.scienceFiction && hasFantasy && !flags.fantasy) mismatchPenalty += 1.4;
  if (flags.fantasy && !hasFantasy) mismatchPenalty += 2.6;
  if (flags.thriller && !hasThriller && !hasMystery) mismatchPenalty += 2.7;
  if (flags.horror && !hasHorror) mismatchPenalty += 2.7;
  if (flags.paranormal && !hasParanormal && !hasHorror) mismatchPenalty += 1.6;
  if (flags.historical && !hasHistorical) mismatchPenalty += 1.35;
  if (flags.drama && !hasDrama) mismatchPenalty += 0.9;
  if (flags.mystery && !hasMystery && !hasThriller) mismatchPenalty += 1.4;
  if (flags.romance && !hasRomance) mismatchPenalty += 1.2;
  if (!flags.romance && hasRomance && (flags.thriller || flags.horror || flags.scienceFiction || flags.fantasy || flags.crime || flags.mystery || flags.historical || flags.drama)) {
    mismatchPenalty += 1.6;
  }
  if ((flags.thriller || flags.horror || flags.paranormal || flags.scienceFiction) && hasComedy) mismatchPenalty += 1.25;
  if (hasJuvenile) mismatchPenalty += 1.35;
  if (fallbackOnly) mismatchPenalty += laneAwareFallbackPenalty(candidate, flags, totalAnchorTerms);

  if (totalAnchorTerms > 0) {
    if (hasZeroAnchorMatch) mismatchPenalty += 3.0;
    else if (totalAnchorTerms >= 2 && anchorCoverage < 0.5) mismatchPenalty += 2.2;
    else if (totalAnchorTerms === 1 && anchorCoverage <= 0) mismatchPenalty += 1.5;

    if (totalAnchorTerms >= 3 && matchedAnchorTerms <= 1) mismatchPenalty += 0.8;
  }

  const anchorAlignmentBoost = totalAnchorTerms > 0
    ? (anchorCoverage * 1.25) +
      (totalAnchorTerms >= 2 && anchorCoverage >= 0.5 ? 0.4 : 0) +
      (anchorCoverage === 1 ? 0.35 : 0)
    : 0;

  const rawScore =
    (coverageScore * 3.1) +
    (anchorScore * 3.4) +
    (strongestScore * 1.45) +
    Math.min(0.8, matchedTerms * 0.1) +
    anchorAlignmentBoost -
    mismatchPenalty;

  let multiplier = 0.45 + (coverageScore * 0.75) + (anchorScore * 0.95) + (strongestScore * 0.35) + (anchorCoverage * 0.3);
  if (hasZeroAnchorMatch) multiplier *= 0.12;
  else if (totalAnchorTerms >= 2 && anchorCoverage < 0.5) multiplier *= 0.45;
  else if (!hasAnchorMatch && totalAnchorTerms > 0) multiplier *= 0.3;
  if (fallbackOnly) multiplier *= 0.55;
  multiplier *= Math.max(0.08, 1 - (mismatchPenalty * 0.24));
  multiplier = Math.max(0.04, Math.min(1.85, multiplier));

  return {
    score: rawScore,
    multiplier,
    coverageScore,
    anchorScore,
    strongestScore,
    matchedTerms,
    matchedAnchorTerms,
    totalAnchorTerms,
    anchorCoverage,
    matchedNonFallbackTerms,
    hasAnchorMatch,
    hasZeroAnchorMatch,
    fallbackOnly,
    mismatchPenalty,
  };
}

function isHardMismatch(candidate: Candidate, lane: RecommenderLane, queryLadder: QueryLadderTerm[]): boolean {
  if (lane !== 'adult') return false;
  const alignment = scoreQueryLadderAlignment(candidate, queryLadder);
  const genreText = normalizeKey([candidate.title, candidate.subtitle || '', candidate.description || '', ...candidate.subjects, ...candidate.genres].join(' | '));
  const hasReferenceSignals = /\b(biography|memoir|autobiography|dictionary|thesaurus|encyclopedia|reference|handbook|manual|study guide|workbook|analysis|criticism|textbook|research|academic)\b/i.test(genreText);
  if (!looksLikeFiction(candidate)) return true;
  if (JUVENILE_PAT.test(genreText)) return true;
  if (hasReferenceSignals) return true;
  if (alignment.mismatchPenalty >= 2.6) return true;
  if (alignment.fallbackOnly) return true;
  if (!queryLadder.some((term) => !term.isFallback) && alignment.score < 1.1) return true;
  return false;
}

function qualifiesForLadder(candidate: Candidate, activeLadder: QueryLadderTerm[], fullLadder: QueryLadderTerm[], lane: RecommenderLane): boolean {
  if (isHardMismatch(candidate, lane, fullLadder)) return false;
  const alignment = scoreQueryLadderAlignment(candidate, activeLadder);
  const anchorCount = activeLadder.filter((term) => term.isAnchor && !term.isFallback).length;

  // Require at least one meaningful non-fallback match.
  if (alignment.matchedNonFallbackTerms === 0) return false;

  // If anchors exist, require at least one anchor match, but do not require high coverage.
  if (anchorCount > 0 && alignment.matchedAnchorTerms === 0) return false;

  // Keep only clearly wrong items out; let scoring handle partial matches.
  if (alignment.mismatchPenalty >= 2.6) return false;

  return alignment.score > -0.5;
}

function scoreForSelection(
  candidate: Candidate,
  lane: RecommenderLane,
  profile: RecommenderProfile,
  fullLadder: QueryLadderTerm[],
  activeLadder: QueryLadderTerm[],
  taste: TasteProfile | undefined,
  memory?: {
    priorRecommendedIds: Set<string>;
    priorRecommendedKeys: Set<string>;
    priorAuthors: Set<string>;
    priorSeriesKeys: Set<string>;
    priorRejectedIds: Set<string>;
    priorRejectedKeys: Set<string>;
  },
): number {
  const trustScore = candidateScore(candidate, lane, profile, taste, fullLadder);
  const fullAlignment = scoreQueryLadderAlignment(candidate, fullLadder);
  const activeAlignment = activeLadder.length ? scoreQueryLadderAlignment(candidate, activeLadder) : fullAlignment;
  const noveltyPenalty = memory ? scoreNoveltyPenalty(candidate, memory) : 0;

  const anchorMatchBonus =
    (fullAlignment.matchedAnchorTerms * 1.15) +
    (fullAlignment.anchorCoverage * 1.6) +
    (fullAlignment.matchedAnchorTerms >= 2 ? 1.25 : 0) +
    (fullAlignment.matchedAnchorTerms >= 3 ? 1.1 : 0);

  const alignmentWeight = 2.0 + (profile.genreStrictness * 1.35);
  const trustWeight = 0.95 + (profile.discoveryBoost * 1.05);

  const sessionTagScore = scoreSessionTagMatch(candidate, fullLadder);
  const negativeSignalPenalty = lane === 'teen'
    ? fullAlignment.mismatchPenalty * profile.negativeSignalPenalty
    : 0;

  return (fullAlignment.score * alignmentWeight)
       + (activeAlignment.score * 1.0)
       + anchorMatchBonus
       + (sessionTagScore * profile.sessionWeight)
       + (trustScore * trustWeight * fullAlignment.multiplier)
       - negativeSignalPenalty
       - noveltyPenalty;
}

function scoreTeenFormatBoost(
  candidate: Candidate,
  lane: RecommenderLane,
  profile: RecommenderProfile,
  queryLadder: QueryLadderTerm[] = [],
): number {
  if (lane !== 'teen') return 0;

  const strongVisualIntent = teenSessionHasStrongVisualIntent(queryLadder);
  const category = candidate.formatCategory || 'prose';

  if (category === 'manga') return (strongVisualIntent ? 8.0 : 4.0) * profile.formatMatchBoost;
  if (category === 'graphic_novel') return (strongVisualIntent ? 5.5 : 3.0) * profile.formatMatchBoost;
  if (category === 'comic') return (strongVisualIntent ? 5.0 : 2.5) * profile.formatMatchBoost;

  const text = haystack(candidate);
  let boost = 0;
  if (/(graphic novel|graphic novels|comics?|comic book)/i.test(text)) boost += strongVisualIntent ? 3.0 : 1.5;
  if (/(manga|anime|manhwa|manhua)/i.test(text)) boost += strongVisualIntent ? 4.0 : 2.0;

  return boost * profile.formatMatchBoost;
}

function isTeenVisualFormatCandidate(candidate: Candidate): boolean {
  if (candidate.formatCategory && candidate.formatCategory !== 'prose') return true;
  const text = haystack(candidate);
  return /(graphic novel|graphic novels|comic|comics|comic book|manga|anime|manhwa|manhua)/i.test(text);
}

function isTeenMangaLikeCandidate(candidate: Candidate): boolean {
  if (candidate.source === 'kitsu') return true;
  if (candidate.source === 'gcd' && isTeenVisualFormatCandidate(candidate)) return true;
  const text = haystack(candidate);
  return /\b(manga|anime|manhwa|manhua|graphic novel|graphic novels|comic|comics|comic book)\b/i.test(text);
}

function teenMangaFormatFloor(
  targetMax: number,
  queryLadder: QueryLadderTerm[],
  profile: RecommenderProfile,
): number {
  if (targetMax <= 0) return 0;
  if (!teenSessionHasStrongVisualIntent(queryLadder)) return 0;
  const configured = Math.max(0, Math.round(profile.minMangaResults || 0));
  if (configured > 0) return Math.min(targetMax, configured);

  const ladderText = queryLadder.map((term) => term.term).join(' | ');
  const mangaFocused = /\b(manga|anime|manhwa|manhua)\b/i.test(ladderText);
  return Math.min(targetMax, mangaFocused ? 2 : 1);
}

function enforceTeenMangaRepresentation(
  selected: Candidate[],
  pool: Candidate[],
  lane: RecommenderLane,
  targetMax: number,
  queryLadder: QueryLadderTerm[],
  profile: RecommenderProfile,
  getScore: (candidate: Candidate) => number,
): Candidate[] {
  if (lane !== 'teen' || !selected.length) return selected;

  const required = teenMangaFormatFloor(targetMax, queryLadder, profile);
  if (required <= 0) return selected;

  const current = [...selected];
  const selectedKeys = new Set(current.map(identityKey));
  let mangaCount = current.filter((candidate) => isTeenMangaLikeCandidate(candidate)).length;

  if (mangaCount >= required) return current;

  const fallbackPool = [...pool]
    .filter((candidate) => isTeenMangaLikeCandidate(candidate))
    .filter((candidate) => !selectedKeys.has(identityKey(candidate)))
    .sort((left, right) => getScore(right) - getScore(left));

  if (!fallbackPool.length) return current;

  const replaceableIndexes = current
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => !isTeenMangaLikeCandidate(candidate))
    .sort((left, right) => getScore(left.candidate) - getScore(right.candidate));

  let injectIndex = 0;
  while (mangaCount < required && injectIndex < fallbackPool.length) {
    const slot = replaceableIndexes.shift();
    const replacement = fallbackPool[injectIndex];
    injectIndex += 1;
    if (!slot || !replacement) break;
    current[slot.index] = replacement;
    selectedKeys.add(identityKey(replacement));
    mangaCount += 1;
  }

  return current;
}


function teenSessionHasStrongVisualIntent(queryLadder: QueryLadderTerm[]): boolean {
  const ladderText = queryLadder.map((term) => term.term).join(" | ");
  return /\b(manga|graphic novel|graphic novels|comic|comics|anime|manhwa|manhua)\b/i.test(ladderText);
}

function teenVisualFormatFloor(targetMax: number, queryLadder: QueryLadderTerm[]): number {
  if (targetMax <= 0) return 0;

  const ladderText = queryLadder.map((term) => term.term).join(' | ');
  const strongIntent =
    /manga/i.test(ladderText) ||
    /graphic novels?/i.test(ladderText) ||
    /comics?/i.test(ladderText);

  if (strongIntent) return Math.max(3, Math.round(targetMax * 0.4));
  return Math.max(2, Math.round(targetMax * 0.2));
}

function enforceTeenVisualFormatFloor(
  selected: Candidate[],
  pool: Candidate[],
  lane: RecommenderLane,
  targetMax: number,
  queryLadder: QueryLadderTerm[],
  getScore: (candidate: Candidate) => number,
): Candidate[] {
  if (lane !== 'teen' || !selected.length) return selected;

  const required = teenVisualFormatFloor(targetMax, queryLadder);
  if (required <= 0) return selected;

  const strongVisualIntent = teenSessionHasStrongVisualIntent(queryLadder);
  const selectedKeys = new Set(selected.map(identityKey));
  const current = [...selected];

  const desiredCategories = strongVisualIntent
    ? new Set(['manga', 'graphic_novel', 'comic'])
    : new Set(['graphic_novel', 'comic']);

  let visualCount = current.filter((candidate) =>
    isTeenVisualFormatCandidate(candidate) && desiredCategories.has(candidate.formatCategory || 'prose')
  ).length;

  if (visualCount >= required) return current;

  const candidatesToInject = [...pool]
    .filter((candidate) => isTeenVisualFormatCandidate(candidate))
    .filter((candidate) => desiredCategories.has(candidate.formatCategory || 'prose'))
    .filter((candidate) => !selectedKeys.has(identityKey(candidate)))
    .sort((left, right) => {
      const categoryWeight = (candidate: Candidate) =>
        candidate.formatCategory === 'manga' ? 3 :
        candidate.formatCategory === 'graphic_novel' ? 2 :
        candidate.formatCategory === 'comic' ? 1 : 0;
      return (getScore(right) + categoryWeight(right)) - (getScore(left) + categoryWeight(left));
    });

  if (!candidatesToInject.length) return current;

  const replaceableIndexes = current
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => !desiredCategories.has(candidate.formatCategory || 'prose'))
    .sort((left, right) => getScore(left.candidate) - getScore(right.candidate));

  let injectIndex = 0;
  while (visualCount < required && injectIndex < candidatesToInject.length) {
    const slot = replaceableIndexes.shift();
    const replacement = candidatesToInject[injectIndex];
    injectIndex += 1;
    if (!slot || !replacement) break;
    current[slot.index] = replacement;
    visualCount += 1;
  }

  return current;
}

function candidateScore(
  candidate: Candidate,
  lane: RecommenderLane,
  profile: RecommenderProfile,
  taste?: TasteProfile,
  queryLadder: QueryLadderTerm[] = [],
): number {
  const popularity = scorePopularity(candidate) * profile.popularityWeight;
  const editionBoost = scoreEditionBoost(candidate) * profile.canonicalBoost;
  const publisherBoost = scorePublisherBoost(candidate) * profile.canonicalBoost;
  const awardBoost = scoreAwardSignal(candidate) * profile.canonicalBoost;
  const nytBoost = scoreNYTBestsellerSignal(candidate) * profile.canonicalBoost;
  const authorReputationBoost = scoreAuthorReputationSignal(candidate) * profile.canonicalBoost;
  const seriesBoost = hasSeriesSignals(candidate) ? 0.15 * profile.discoveryBoost : 0;
    const anthologyRisk = scoreAnthologyCollectionRisk(candidate);
  const anthologyCollectionPenalty =
    -(anthologyRisk.penalty * profile.compendiumPenalty * (anthologyRisk.penalty >= 0.18 ? 2.2 : 1.35));
  const tasteBoost = scoreTasteMatch(candidate, taste) * profile.moodStrictness;
  const driftPenalty = looksJuvenileOrClassicDrift(candidate, lane) ? -1.25 * profile.driftPenalty : 0;
  const lowSignalPenalty = looksLowSignalOrObscure(candidate, lane) ? -1.7 * profile.obscurePenalty : 0;
  const mediaTieInPenalty = -scoreMediaTieInRisk(candidate, lane) * profile.mediaTieInPenalty;
  const recencyBoost = scoreRecencyBoost(candidate) * profile.recencyWeight;
  const titleSpamPenalty = -scoreTitleSpamPenalty(candidate, lane) * profile.titleSpamPenalty;
  const coverPenalty = -scoreCoverQualityPenalty(candidate, lane) * profile.coverPenalty;
  const fictionPenalty = looksLikeFiction(candidate) ? 0 : -0.75 * profile.fictionStrictness;
  const sourceWeight =
    candidate.source === 'googleBooks'
      ? profile.sourceWeightGoogleBooks
      : candidate.source === 'kitsu'
      ? profile.sourceWeightOpenLibrary + profile.kitsuSourceBoost
      : candidate.source === 'gcd'
      ? profile.sourceWeightOpenLibrary + Math.max(0.5, profile.formatMatchBoost * 0.5)
      : profile.sourceWeightOpenLibrary;
  const authorPenalty = -0.25 * profile.authorPenaltyStrength;
  const diversityBoost =
    (candidate.title && candidate.title.length > 50 ? -0.1 : 0) * profile.semanticDiversityBoost;
  const teenFormatBoost = scoreTeenFormatBoost(candidate, lane, profile, queryLadder);

  return (
    popularity +
    editionBoost +
    publisherBoost +
    awardBoost +
    nytBoost +
    authorReputationBoost +
    seriesBoost +
    anthologyCollectionPenalty +
    tasteBoost +
    driftPenalty +
    lowSignalPenalty +
    mediaTieInPenalty +
    recencyBoost +
    titleSpamPenalty +
    coverPenalty +
    fictionPenalty +
    sourceWeight +
    authorPenalty +
    diversityBoost +
    teenFormatBoost
  );
}

function applySoftFilter<T>(items: T[], isBackfill: (item: T) => boolean, minKeep: number): T[] {
  const good: T[] = [];
  const backfill: T[] = [];
  for (const item of items) {
    if (isBackfill(item)) backfill.push(item);
    else good.push(item);
  }
  return good.length >= minKeep ? good : [...good, ...backfill].slice(0, Math.max(minKeep, good.length + backfill.length));
}

function enforceAuthorDiversity(candidates: Candidate[], limit: number): Candidate[] {
  const counts = new Map<string, number>();
  return candidates.filter((candidate) => {
    const key = candidate.author || 'Unknown';
    const next = (counts.get(key) || 0) + 1;
    if (next > Math.max(1, limit)) return false;
    counts.set(key, next);
    return true;
  });
}

function seriesDiversityKey(candidate: Candidate): string {
  const title = normalizeKey(candidate.title);
  if (!title) return '';
  const normalized = title
    .replace(/\b(book|volume|vol|part|episode|season)\b\s*(?:#|no\.?|number)?\s*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, ' ')
    .replace(/\b(epilogue|prologue|finale|the final|the beginning|the return|rising|reckoning|resurrection|legacy|aftermath|endgame)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || title;
}

function normalizeKeySet(values: Array<string | undefined> | undefined): Set<string> {
  const out = new Set<string>();
  for (const value of values || []) {
    const normalized = normalizeKey(value);
    if (normalized) out.add(normalized);
  }
  return out;
}

function normalizeIdSet(values: Array<string | undefined> | undefined): Set<string> {
  const out = new Set<string>();
  for (const value of values || []) {
    const normalized = normalizeText(value).trim();
    if (normalized) out.add(normalized);
  }
  return out;
}

function normalizeAuthorKey(value: string | undefined): string {
  return normalizeKey(value);
}

function scoreNoveltyPenalty(
  candidate: Candidate,
  memory: {
    priorRecommendedIds: Set<string>;
    priorRecommendedKeys: Set<string>;
    priorAuthors: Set<string>;
    priorSeriesKeys: Set<string>;
    priorRejectedIds: Set<string>;
    priorRejectedKeys: Set<string>;
  },
): number {
  const candidateId = normalizeText(candidate.id).trim();
  const candidateKey = identityKey(candidate);
  const authorKey = normalizeAuthorKey(candidate.author);
  const seriesKey = seriesDiversityKey(candidate);

  let penalty = 0;

  if (candidateId && memory.priorRecommendedIds.has(candidateId)) penalty += 6.5;
  if (candidateKey && memory.priorRecommendedKeys.has(candidateKey)) penalty += 5.2;
  if (candidateId && memory.priorRejectedIds.has(candidateId)) penalty += 2.8;
  if (candidateKey && memory.priorRejectedKeys.has(candidateKey)) penalty += 2.1;
  if (authorKey && memory.priorAuthors.has(authorKey)) penalty += 1.35;
  if (seriesKey && memory.priorSeriesKeys.has(seriesKey)) penalty += 1.75;

  return penalty;
}

function enforceSeriesDiversity(candidates: Candidate[], limit: number): Candidate[] {
  const counts = new Map<string, number>();
  return candidates.filter((candidate) => {
    const key = seriesDiversityKey(candidate);
    if (!key) return true;
    const next = (counts.get(key) || 0) + 1;
    if (next > Math.max(1, limit)) return false;
    counts.set(key, next);
    return true;
  });
}

function runFinalPass(
  candidates: Candidate[],
  lane: RecommenderLane,
  profile: RecommenderProfile,
  tasteProfile?: TasteProfile,
  options: Omit<FinalRecommenderOptions, 'lane'> = {},
): RecommendationDoc[] {
  const baseCandidates = (Array.isArray(candidates) ? candidates : []);
  const ladderSeed = baseCandidates.filter((candidate) => {
    const rung = Number.isFinite(Number(candidate.queryRung)) ? Number(candidate.queryRung) : 0;
    return rung === 0;
  });
  const queryLadder = buildQueryLadder(ladderSeed.length ? ladderSeed : baseCandidates.slice(0, 20));
  const base = dedupeCandidates(
    (Array.isArray(candidates) ? candidates : []).filter((candidate) => candidate.title && !BAD_TITLE_PAT.test(candidate.title))
  );

  logFinalPassStage('base', base, {
    lane,
    queryLadderCount: queryLadder.length,
    anchorCount: queryLadder.filter((term) => term.isAnchor && !term.isFallback).length,
  });

  const fictionOnly = applySoftFilter(base, (candidate) => !looksLikeFiction(candidate), Math.max(profile.minKeep, 10));
  logFinalPassStage('fictionOnly', fictionOnly);

  const withoutWritingGuides = applySoftFilter(fictionOnly, (candidate) => looksLikeWritingGuide(candidate), Math.max(profile.minKeep, 10));
  logFinalPassStage('withoutWritingGuides', withoutWritingGuides);

  const withoutCompendiums = applySoftFilter(withoutWritingGuides, (candidate) => scoreAnthologyCollectionRisk(candidate).hardFilter, Math.max(profile.minKeep, 10));
  logFinalPassStage('withoutCompendiums', withoutCompendiums);

  const withoutJuvenileDrift = applySoftFilter(
    withoutCompendiums,
    (candidate) => lane === 'adult' && looksJuvenileOrClassicDrift(candidate, lane),
    Math.max(profile.minKeep, 10),
  );
  logFinalPassStage('withoutJuvenileDrift', withoutJuvenileDrift);

  const withoutMediaTieIns = applySoftFilter(withoutJuvenileDrift, (candidate) => scoreMediaTieInRisk(candidate, lane) >= 0.3, Math.max(profile.minKeep, 10));
  logFinalPassStage('withoutMediaTieIns', withoutMediaTieIns);

  const withoutTitleSpam = applySoftFilter(withoutMediaTieIns, (candidate) => scoreTitleSpamPenalty(candidate, lane) >= 0.3, Math.max(profile.minKeep, 10));
  logFinalPassStage('withoutTitleSpam', withoutTitleSpam);

  const withoutCoverFailures = applySoftFilter(withoutTitleSpam, (candidate) => scoreCoverQualityPenalty(candidate, lane) >= 0.65, Math.max(profile.minKeep, 10));
  logFinalPassStage('withoutCoverFailures', withoutCoverFailures);

  const credibleOnly = applySoftFilter(
    withoutCoverFailures,
    (candidate) => {
      const preserveVisualCandidate =
        lane === 'teen' &&
        teenSessionHasStrongVisualIntent(queryLadder) &&
        isTeenVisualFormatCandidate(candidate);

      if (preserveVisualCandidate) return false;

      return (
        candidate.ratingCount < Math.max(2, Math.round(6 * profile.credibilityFloor)) &&
        candidate.editionCount < Math.max(2, Math.round(4 * profile.credibilityFloor)) &&
        metadataSignals(candidate) <= Math.round(9 + (1 - profile.credibilityFloor) * 2)
      );
    },
    Math.max(profile.minKeep, 10)
  );
  logFinalPassStage('credibleOnly', credibleOnly);

  const targetMin = Math.max(8, profile.minKeep || 0);
  const targetMax = Math.max(10, targetMin);
  const ladders = buildRelaxedLadders(queryLadder);
  logFinalPassStage('laddersBuilt', credibleOnly, {
    laddersCount: ladders.length,
    targetMin,
    targetMax,
  });

  const memory = {
    priorRecommendedIds: normalizeIdSet(options.priorRecommendedIds),
    priorRecommendedKeys: normalizeKeySet(options.priorRecommendedKeys),
    priorAuthors: normalizeKeySet(options.priorAuthors),
    priorSeriesKeys: normalizeKeySet(options.priorSeriesKeys),
    priorRejectedIds: normalizeIdSet(options.priorRejectedIds),
    priorRejectedKeys: normalizeKeySet(options.priorRejectedKeys),
  };
  const selected: Candidate[] = [];
  const seen = new Set<string>();

const addRanked = (pool: Candidate[], activeLadder: QueryLadderTerm[]) => {
  const scored = pool.map((candidate) => {
    const score = scoreForSelection(candidate, lane, profile, queryLadder, activeLadder, tasteProfile, memory);
    return { candidate, score };
  });

  const ranked = scored
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.candidate.ratingCount !== left.candidate.ratingCount) return right.candidate.ratingCount - left.candidate.ratingCount;
      if (right.candidate.averageRating !== left.candidate.averageRating) return right.candidate.averageRating - left.candidate.averageRating;
      return left.candidate.title.localeCompare(right.candidate.title);
    });

  // 🔍 DEBUG: Teen visual-format scoring visibility
  if (lane === 'teen') {
    try {
      const top = ranked.slice(0, 15).map((entry, index) => ({
        rank: index + 1,
        title: entry.candidate.title,
        score: Number(entry.score.toFixed(3)),
        visual: isTeenVisualFormatCandidate(entry.candidate),
        source: entry.candidate.source,
      }));

      console.log('[NovelIdeas][teenScoringDebug][topCandidates]', top);
    } catch {}
  }

  for (const entry of ranked) {
    const candidate = entry.candidate;
    const key = identityKey(candidate);
    if (seen.has(key)) continue;
    selected.push(candidate);
    seen.add(key);
    if (selected.length >= targetMax) break;
  }
};

  if (!ladders.length) {

    const qualified = credibleOnly.filter((candidate) => !isHardMismatch(candidate, lane, queryLadder));
    logFinalPassStage('qualifiedNoLadders', qualified);
    addRanked(qualified, []);
    logFinalPassStage('selectedAfterNoLadders', selected);
  } else {
    for (let ladderIndex = 0; ladderIndex < ladders.length; ladderIndex += 1) {
      const activeLadder = ladders[ladderIndex];
      const qualified = credibleOnly.filter((candidate) => !seen.has(identityKey(candidate)) && qualifiesForLadder(candidate, activeLadder, queryLadder, lane));
      logFinalPassStage('qualifiedPerLadder', qualified, {
        ladderIndex,
        activeLadderCount: activeLadder.length,
        activeAnchorCount: activeLadder.filter((term) => term.isAnchor && !term.isFallback).length,
      });
      addRanked(qualified, activeLadder);
      logFinalPassStage('selectedAfterLadder', selected, { ladderIndex });
      if (selected.length >= targetMin) break;
    }
  }

  if (selected.length < targetMin) {
    const remainingBackfillPool = credibleOnly.filtery.filter((candidate) => !seen.has(identityKey(candidate)) && !isHardMismatch(candidate, lane, queryLadder));
logFinalPassStage('remainingBackfillPool', remainingBackfillPool)
addRanked(remainingBackfillPool, queryLadder)
    logFinalPassStage('selectedAfterBackfill', selected);
  }

  const selectedWithTeenFormatFloor = enforceTeenVisualFormatFloor(
    selected,
    credibleOnly,
    lane,
    targetMax,
    queryLadder,
    (candidate) => scoreForSelection(candidate, lane, profile, queryLadder, queryLadder, tasteProfile, memory),
  );
  const selectedWithTeenMangaRepresentation = enforceTeenMangaRepresentation(
    selectedWithTeenFormatFloor,
    remainingBackfillPool,
    lane,
    targetMax,
    queryLadder,
    profile,
    (candidate) => scoreForSelection(candidate, lane, profile, queryLadder, queryLadder, tasteProfile, memory),
  );
  logFinalPassStage('selectedWithTeenFormatFloor', selectedWithTeenMangaRepresentation, {
    teenVisualFormatCount: selectedWithTeenMangaRepresentation.filter(isTeenVisualFormatCandidate).length,
    teenVisualFormatRequired: lane === 'teen' ? teenVisualFormatFloor(targetMax, queryLadder) : 0,
    teenMangaCount: selectedWithTeenMangaRepresentation.filter(isTeenMangaLikeCandidate).length,
    teenMangaRequired: lane === 'teen' ? teenMangaFormatFloor(targetMax, queryLadder, profile) : 0,
  });

  const authorDiverse = enforceAuthorDiversity(selectedWithTeenMangaRepresentation, profile.authorRepeatLimit);
  logFinalPassStage('authorDiverse', authorDiverse);

  const seriesDiverse = enforceSeriesDiversity(authorDiverse, 1);
  logFinalPassStage('seriesDiverse', seriesDiverse);

  const finalWithTeenFormatFloor = enforceTeenVisualFormatFloor(
    seriesDiverse,
    credibleOnly,
    lane,
    targetMax,
    queryLadder,
    (candidate) => scoreForSelection(candidate, lane, profile, queryLadder, queryLadder, tasteProfile, memory),
  );
  const finalWithTeenMangaRepresentation = enforceTeenMangaRepresentation(
    finalWithTeenFormatFloor,
    remainingBackfillPool,
    lane,
    targetMax,
    queryLadder,
    profile,
    (candidate) => scoreForSelection(candidate, lane, profile, queryLadder, queryLadder, tasteProfile, memory),
  );
  logFinalPassStage('finalWithTeenFormatFloor', finalWithTeenMangaRepresentation, {
    teenVisualFormatCount: finalWithTeenMangaRepresentation.filter(isTeenVisualFormatCandidate).length,
    teenVisualFormatRequired: lane === 'teen' ? teenVisualFormatFloor(targetMax, queryLadder) : 0,
    teenMangaCount: finalWithTeenMangaRepresentation.filter(isTeenMangaLikeCandidate).length,
    teenMangaRequired: lane === 'teen' ? teenMangaFormatFloor(targetMax, queryLadder, profile) : 0,
  });

  return finalWithTeenMangaRepresentation.slice(0, targetMax).map((candidate) => ({
    ...candidate.rawDoc,
    source: candidate.source,
    title: candidate.title,
    author_name: candidate.authors.length ? candidate.authors : candidate.rawDoc.author_name,
    first_publish_year: candidate.publicationYear || candidate.rawDoc.first_publish_year,
    edition_count: candidate.editionCount || (candidate.rawDoc as any).edition_count,
    publisher: candidate.publisher || (candidate.rawDoc as any).publisher,
    description: candidate.description || (candidate.rawDoc as any).description,
    averageRating: candidate.averageRating || (candidate.rawDoc as any).averageRating,
    ratingsCount: candidate.ratingCount || (candidate.rawDoc as any).ratingsCount,
    subject: candidate.subjects.length ? candidate.subjects : (candidate.rawDoc as any).subject,
  } as RecommendationDoc));
}

export function finalRecommender(candidates: Candidate[], lane: RecommenderLane, options: Omit<FinalRecommenderOptions, 'lane'> = {}): RecommendationDoc[] {
  const profile = { ...recommenderProfiles[lane], ...(options.profileOverride || {}) };
  const candidateList = Array.isArray(candidates) ? candidates : [];
  return runFinalPass(candidateList, lane, profile, options.tasteProfile, options);
}

export function finalRecommenderForDeck(candidates: Candidate[], deckKey: DeckKey, options: Omit<FinalRecommenderOptions, 'lane' | 'deckKey'> = {}): RecommendationDoc[] {
  return finalRecommender(candidates, laneFromDeckKey(deckKey), { ...options, deckKey });
}
