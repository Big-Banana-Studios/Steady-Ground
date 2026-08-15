/* Child-safety layers.

   The model is a 1.2B parameter model running on the child's own device. It has
   nothing like the safety training of a large hosted model, so the safety lives
   here, in the app around it, and not in the model's good intentions.

   Layers, in order of when they run:

     1. Safety preamble on every system prompt          (prompts.js)
     2. Input check — before anything reaches the model (this file)
     3. Output check — before anything reaches the eyes (this file)
     4. Hardcoded fallbacks when a check fails          (this file)
     5. Length cap per tab, cut at a sentence boundary  (this file)
     6. Nothing a child types is ever persisted         (app.js)
     7. A "For Parents" panel that says all of the above (index.html)

   Two deliberate departures from a plain blocklist, both explained where they
   are implemented:

   - Distress is not treated as misbehaviour. A child who types something about
     hurting themselves gets a warm, hardcoded card pointing them at a real
     human, never a "try a school topic instead" brush-off, and never the model.
   - Sensitive-but-real school subjects (drugs in health class, assault in a
     history unit) get "ask a grown-up about that one" rather than the same
     message as swearing. Being told off for a legitimate question teaches a kid
     to stop asking. */

export const MAX_INPUT_CHARS = 2000;

/* ------------------------------------------------------------ normalising

   Matching runs against a cleaned-up copy of the text so that the obvious
   dodges — sh1t, f*ck, fuuuuck — land on the same patterns as the plain
   spelling. The child never sees this copy; it exists only to be tested. */

const LEET = {
  '@': 'a', '4': 'a', '8': 'b', '3': 'e', '6': 'g', '1': 'i', '!': 'i',
  '|': 'i', '0': 'o', '5': 's', '$': 's', '7': 't', '+': 't',
};

/* Typographic punctuation, flattened to the plain ASCII this file's patterns are
   written in. Not cosmetic: the model writes "Let's" and "don't" with a curly
   apostrophe far more often than a straight one, and every pattern here spells
   them straight — so /let'?s/ silently stopped matching, and with it a slice of
   the crisis list, the injection list, the put-downs and the sign-off trim.
   Found because a curly "Let's keep going together" walked past the trim. */
const straighten = (text) => String(text)
  .replace(/[‘’‛′]/g, "'")
  .replace(/[“”″]/g, '"')
  .replace(/[‐-―]/g, '-');

// Lowercase and plain-quoted: what every pattern in this file expects to see.
const flatten = (text) => straighten(text).toLowerCase();

function normalise(text) {
  return straighten(text)
    .toLowerCase()
    .normalize('NFKD')                       // splits accents off, for é as e
    .replace(/[̀-ͯ]/g, '')       // then drops them
    .replace(/[@48361!|05$7+]/g, (c) => LEET[c] || c)
    .replace(/(.)\1{2,}/g, '$1');            // fuuuuck → fuck, but cool stays cool
}

// Every non-letter removed, for the handful of patterns below that are long and
// unambiguous enough to survive words being run together. Short words are kept
// out of this pass on purpose: squeezing turns "the rapist" into "therapist".
const squeeze = (text) => normalise(text).replace(/[^a-z]/g, '');

// The self-censored spellings — f*ck, sh#t — with the star taken out. What is
// left is a consonant skeleton that is not a word in its own right, which is
// why these can be matched safely.
const decensor = (text) => normalise(text).replace(/[*#%]+/g, '');

const CENSORED = [
  /\bfck\w*\b/, /\bfk\b/, /\bsht\b/, /\bshty\b/, /\bbtch\w*\b/, /\bcnt\b/,
  /\bdck\b/, /\bahole\b/, /\bbstrd\b/, /\bnga\b/, /\bnggr\b/, /\bfggt\b/,
];

/* --------------------------------------------------------------- patterns */

/* Distress. Checked first and separately from everything else, so a frightened
   child who also swore still gets the care card rather than a telling-off. */
const CRISIS = [
  /\bkill(ing)?\s+(myself|my\s?self)\b/,
  /\bkill\s+your\s?self\b/,           // never from the child, but never from the model either
  /\b(i|i'?m|im)\s+(want|wanna|going)\s+to\s+die\b/,
  /\bwant\s+to\s+die\b/,
  /\bwish\s+i\s+(was|were)\s+dead\b/,
  /\bbetter\s+off\s+(without\s+me|dead)\b/,
  /\bsuicid(e|al)\b/,
  /\bend\s+(my|it)\s+(life|all)\b/,
  /\bself[\s-]?harm/,
  /\b(hurt|hurting|cut|cutting|burn|burning)\s+(myself|my\s?self)\b/,
  /\bcut\s+my\s+(wrist|arm|leg)/,
  /\bi\s+hate\s+(myself|my\s+life)\b/,
  /\b(nobody|no\s?one)\s+(would|will)\s+(miss|care\s+about)\s+me\b/,
  /\bwant\s+to\s+disappear\b/,
  /\bstarv(e|ing)\s+myself\b/,
  /\bmake\s+myself\s+(throw\s+up|puke|vomit|sick)\b/,
  // Threats to others read as an emergency too, not as a topic to discuss.
  /\b(shoot|blow)\s+up\s+(my|the)\s+school\b/,
  /\bkill\s+(everyone|them\s+all|my\s+(class|classmates|family))\b/,
  // Harm at home. Broad on purpose — "tell a grown-up you trust" is a safe
  // answer even when the child only meant a scuffle with a sibling.
  /\b(dad|mom|mum|father|mother|stepdad|stepmom|uncle|aunt|nan|gran|grandad|brother|sister|he|she|they)\s+(hits|hit|beats|beat|punches|punched|hurts|hurt|kicks|kicked)\s+me\b/,
  /\b(abuses?|abused|abusing|molest\w*)\s+me\b/,
  /\bi'?m\s+being\s+(hurt|abused|hit|beaten)\b/,
  /\btouch(ed|es|ing)\s+me\b[\s\S]{0,30}\b(private|down\s+there|inappropriate|weird|bad\s+way)\b/,
  /\b(private\s+parts|inappropriate(ly)?\s+touch)/,
  /\bscared\s+to\s+go\s+home\b/,
  /\b(run|running|ran)\s+away\s+from\s+home\b/,
  /\bnot\s+safe\s+at\s+home\b/,
];

/* Attempts to talk past the system prompt. Blocked rather than answered — a
   child poking at the edges is normal, and the app just declines to play. */
const INJECTION = [
  /\b(ignore|disregard|forget|override)\s+(all\s+|your\s+|the\s+|any\s+|previous\s+|prior\s+|these\s+)*(instruction|rule|prompt|direction|guideline)/,
  /\bforget\s+(everything|what)\s+(you|i)\b/,
  /\byou\s+are\s+now\b/, /\byou'?re\s+now\b/,
  /\bfrom\s+now\s+on\s+you\b/,
  /\bpretend\s+(you|to\s+be|that\s+you|we|this)/,
  /\bact\s+as\s+(a|an|if|though|my)\b/,
  /\brole[\s-]?play/,
  /\bnew\s+(instructions?|rules?|system)\b/,
  /\bsystem\s+prompt\b/,
  /\byour\s+(system\s+)?(prompt|instructions|rules)\b/,
  /\b(jailbreak|dan\s+mode|developer\s+mode|god\s+mode)\b/,
  /\bbypass\s+(your|the|all)\s+(rules|filters|restrictions|safety)/,
  /\bwithout\s+(any\s+)?(restrictions|filters|rules|limits)\b/,
  /\b(repeat|print|show|reveal|output)\s+(the|your)\s+(above|prompt|instructions|rules)\b/,
  /\bno\s+longer\s+(bound|restricted)\b/,
  // Chat-format and special-token injection, including this model's own tokens.
  /^\s*(system|assistant)\s*:/m,
  /<\|[^|]*\|>/,
  /\b(im_start|im_end|endoftext)\b/,
  /###\s*(instruction|system|response)/,
];

/* Slurs. Kept apart from ordinary swearing only so the squeezed pass can be
   applied to them; the child sees the same gentle message either way.
   "retard" sits here deliberately: this app is built for neurodivergent kids
   and that word is not a swear to them, it is a weapon. */
const SLUR = [
  /\bn[i]gg?(er|a|as|ers)\b/, /\bfagg?(ot|ots|s)?\b/, /\bretard(ed|s)?\b/,
  /\bspast(ic|ics)\b/, /\bmong(oloid)?\b/, /\btrann(y|ies)\b/,
  /\bkikes?\b/, /\bchinks?\b/, /\bgooks?\b/, /\bwetbacks?\b/, /\bbeaners?\b/,
  /\bspics?\b/, /\bpakis?\b/, /\braghead/, /\btowelhead/, /\bcoons?\b/,
  /\bhonk(y|ies)\b/, /\bjaps?\b/,
];

/* Words the model must never use that a child might type innocently. "dyke" is
   a sea wall in geography and a rock formation in geology; a child asking about
   the Netherlands should not be stopped, and the model should still never say
   it. Same idea for the put-downs: "there are no stupid questions" is a fine
   sentence, "you're stupid" is not. */
const OUTPUT_ONLY = [
  /\bdykes?\b/, /\bqueers?\b/,
  /\byou'?re\s+(stupid|dumb|an\s+idiot|thick|slow)\b/,
  /\b(shut\s+up|how\s+stupid|are\s+you\s+dumb)\b/,
  /\bidiots?\b/, /\bmorons?\b/,
];

const PROFANITY = [
  /\bf+u+c+k+\w*\b/, /\bf+u+k+s?\b/, /\bfck\b/, /\bfuq\b/, /\bstfu\b/, /\bwtf\b/,
  /\bsh[i]t+\w*\b/, /\bbullsh[i]t\b/, /\bshite\b/,
  /\bb[i]tch(es|ing|y)?\b/, /\bbastard(s)?\b/, /\bcunts?\b/,
  /\bd[i]ck(head|s)?\b/, /\bcocks?\b/, /\bpricks?\b/, /\bwank(er|ers|ing)?\b/,
  /\btwats?\b/, /\bpiss(ed|ing)?\b/, /\barse(hole)?s?\b/, /\bass(hole|holes|es)?\b/,
  /\bjackass\b/, /\bdumbass\b/, /\bslags?\b/, /\bsluts?\b/, /\bwhores?\b/,
  /\bdouche(bag)?\b/, /\bbollocks\b/, /\bbugger\b/, /\bmotherf\w*\b/,
];

/* Sexual content. Anatomy and topics that turn up in health and biology are in
   the same list, because the honest answer for both is the same: this is not
   the tool for that conversation. The message says so kindly. */
const SEXUAL = [
  /\bsex(y|ual|ually|ting)?\b/, /\bporn(o|ography|hub)?\b/, /\bnsfw\b/, /\bxxx\b/,
  /\bblow\s?job/, /\bhand\s?job/, /\bboobs?\b/, /\btits?\b/, /\btitties\b/,
  /\bpen[i]s(es)?\b/, /\bvaginas?\b/, /\bvulva\b/, /\btesticles?\b/, /\bballsack\b/,
  /\bmasturbat\w*/, /\borgasm\w*/, /\bhorny\b/, /\bnudes?\b/, /\bnaked\s+(photo|pic)/,
  /\berection\b/, /\bboner\b/, /\bcum(ming|shot)?\b/, /\bjizz\b/, /\bdildo/,
  /\bhentai\b/, /\banal\b/, /\bbdsm\b/, /\bfetish/, /\bmilf\b/, /\bincest\b/,
  /\bpedo(phile|philia)?\b/, /\bgroom(ing|er)\s+(kids?|children)\b/,
  /\brap(e|ed|ing|ist)\b/, /\bonlyfans\b/, /\bstriptease\b/, /\bprostitut\w*/,
  /* Adultery arrives by way of RE homework — the Ten Commandments — rather than
     anything a child went looking for, so it is here rather than in the blocked
     list: the answer is "ask a grown-up", not "try a school topic". A 1.2B model
     asked to explain it to a child produced incoherent analogies about door
     locks and a story that argued the opposite of the commandment. "The Ten
     Commandments" on its own still goes straight through. */
  /\badulter(y|er|ers|ess|ous)\b/, /\bfornicat\w*/,
  /\bcheat(ing|ed)?\s+on\s+(his|her|their|my)\s+(wife|husband|partner|girlfriend|boyfriend)\b/,

  /* Growing up and where babies come from. These are not rude words and a child
     asking is doing nothing wrong — they are simply the conversation a family
     wants to have itself, in its own words, at the time it chooses. The message
     they get says so.

     "sperm" carries a lookahead because a sperm whale is a perfectly good
     science topic, and "ovary" is left out entirely: flowers have them, and
     plant reproduction is on the syllabus. */
  /\bpuberty\b/, /\bpubert\w*/,
  /\bhow\s+(are|do)\s+babies\s+(made|get\s+made)\b/, /\bwhere\s+do\s+babies\s+come\s+from\b/,
  /\bmenstruat\w*/, /\b(my|her|a)\s+period\s+(started|came|is)\b/, /\bgetting\s+my\s+period\b/,
  /\bpregnan\w*/, /\bsperm\b(?!\s*whale)/, /\bejaculat\w*/,
  /\bwombs?\b/, /\buterus\b/, /\bcontracepti\w*/, /\bcondoms?\b/, /\bvirginity\b/,
];

/* Substances. "adderall" and "ritalin" are in here knowing full well an ADHD
   child may take one of them — a 1.2B model must not be the thing that tells a
   kid about their own medication. It hands that back to a grown-up. */
const SUBSTANCE = [
  /\bcocaine\b/, /\bcrack\s+cocaine\b/, /\bheroin\b/, /\bmeth(amphetamine)?\b/,
  /\bmarijuana\b/, /\bcannabis\b/, /\bsmok(e|es|ing)\s+(weed|pot|a\s+joint)\b/,
  /\bvap(e|es|ing)\b/, /\bjuul\b/, /\bnicotine\b/, /\bcigarettes?\b/,
  /\b(start|started|starts)\s+smoking\b/,
  /\balcohol(ic|ism)?\b/, /\bvodka\b/, /\bwhisk(e)?y\b/, /\btequila\b/,
  /\bget(ting)?\s+drunk\b/, /\bget(ting)?\s+high\b/,
  /\bhigh\s+on\s+(drugs|weed|pills|coke|meth)\b/,
  /\blsd\b/, /\becstasy\s+(pill|drug)/, /\bmdma\b/, /\bketamine\b/, /\bxanax\b/,
  /\badderall\b/, /\britalin\b/, /\bopioids?\b/, /\bfentanyl\b/, /\boverdos(e|ing)\b/,
  /\bbongs?\b/, /\bshrooms?\b/, /\bpsilocybin\b/, /\banabolic\s+steroids?\b/,
  /\bdrug\s+(deal|dealer|dealing|addict)/, /\bdo(ing)?\s+drugs\b/, /\btak(e|ing)\s+drugs\b/,
];

/* Who people are and who they love.

   Routed home at the parent's instruction, after the model was asked what
   "lesbian" means and answered that it is "just about being friends with
   someone who cares deeply about you" — not a simplification but a wrong
   answer, and one that erases the word it was asked to explain.

   This is a family's call and it was made by the family. The message a child
   gets is the same warm one that points them at a parent or carer; nothing here
   suggests there is anything wrong with the question, because there isn't.

   Care taken over the biology and grammar that shares this vocabulary: asexual
   reproduction, trans fats, binary numbers and the gender of French nouns are
   all still ordinary schoolwork. */
const IDENTITY = [
  /\blesbians?\b/, /\bgay\b/, /\bbisexual\b/, /\bhomosexual\w*/, /\bheterosexual\w*/,
  /\blgbtq?i?a?\+?\b/, /\btransgender\w*/, /\btranssexual\w*/,
  /\btrans\s+(person|people|kid|kids|girl|boy|man|woman|men|women|rights)\b/,
  /\bnon[\s-]?binary\b/, /\bdrag\s+queens?\b/, /\bsame[\s-]sex\b/,
  /\bsexualit\w*/, /\bsexual\s+orientation\b/, /\bgender\s+(identity|dysphoria)\b/,
  /\basexual\b(?!\s+reproduction)/,
  /\bcoming\s+out\s+(as|to\s+my)\b/,
];

/* Questions that have no factual answer.

   Not religion — religion is a school subject with facts in it, and after the
   belief rule went into the prompt (see BELIEF_RULE) the model can hand those
   over properly: what a text is, when it was written, who follows it, what they
   believe. The Bible, the Torah, the Quran, the Ten Commandments and "thou
   shalt not steal" all go straight through and get described from the outside.

   What is left here is the handful of questions where there is nothing factual
   to say: whether God is real, why God permits suffering, which religion is
   right, what happens after death. A 1.2B model answering those for someone
   else's child is not a filtering problem, it is a category error — the answer
   belongs to the family. */
const BELIEF_QUESTION = [
  /\b(is|are)\s+(god|jesus|allah|heaven|hell|the\s+devil)\s+(real|true)\b/,
  /\bdoes\s+god\s+(exist|love|hate|care)\b/,
  /\bwhy\s+does\s+god\b/,
  /\bwhat\s+(does\s+|did\s+)?god\s+(say|says|said|want|wants|think|thinks)\b/,
  /\bwhich\s+religion\s+is\s+(right|true|best|correct)\b/,
  /\bis\s+\w+\s+(religion|faith)\s+(right|true|real)\b/,
  /\bshould\s+i\s+(believe|be\s+a|pray)\b/,
  /\bwhat\s+happens\s+(to\s+(you|us|me)\s+)?(when|after)\s+(you|we|i|people)\s+die\b/,
  /\bis\s+there\s+(a\s+)?(god|heaven|an\s+afterlife)\b/,
];

/* Violence. Narrow and phrase-shaped on purpose. "war", "gun", "battle",
   "murder", "slavery", "holocaust" and the rest are ordinary curriculum and
   must stay askable — blocking the Civil War would break the app for history
   homework, which is exactly the over-blocking the brief warns about. */
const VIOLENCE = [
  /\bhow\s+(to|do\s+i)\s+(make|build|create|get)\s+(a\s+)?(bomb|gun|weapon|explosive|silencer)/,
  /\bpipe\s+bomb\b/, /\bmolotov\b/, /\bnapalm\s+recipe\b/, /\bhomemade\s+explosive/,
  /\bhow\s+(to|do\s+i)\s+(kill|stab|shoot|poison|strangle|hurt)\s+(someone|somebody|a\s+person|people|him|her|them|my)\b/,
  /\bhow\s+(to|do\s+i)\s+(fight|beat\s+up)\s+(someone|somebody|him|her|them|my)\b/,
  /\bschool\s+shoot(er|ing|ings)\b/,
  /\bhurt\s+(someone|somebody|people)\s+(badly|really)/,
  /\bget\s+away\s+with\s+(murder|killing|it)\b/,
];

// Long enough to be unmistakable even with every space and dot removed.
const SQUEEZED = [
  /nigg[ae]r?s?/, /faggots?/, /motherfuck/, /killmyself/, /killingmyself/,
  /wanttodie/, /suicide/, /childporn/, /pedophile/, /iwanttodie/, /cuttingmyself/,
];

// Letters separated by punctuation or spaces: "f u c k", "s-h-i-t". Every gap
// must be a real separator, so ordinary text like "this hit" cannot match.
const SPACED = [
  /\bf\W+u\W+c\W+k\b/, /\bs\W+h\W+i\W+t\b/, /\bb\W+i\W+t\W+c\W+h\b/,
  /\bn\W+i\W+g\W+g\W+[ae]r?\b/, /\bc\W+u\W+n\W+t\b/,
];

const CATEGORIES = [
  { kind: 'crisis',    patterns: CRISIS },
  { kind: 'blocked',   patterns: INJECTION },
  { kind: 'blocked',   patterns: SLUR },
  { kind: 'blocked',   patterns: PROFANITY },
  { kind: 'family',    patterns: SEXUAL },
  { kind: 'family',    patterns: IDENTITY },
  { kind: 'sensitive', patterns: SUBSTANCE },
  { kind: 'sensitive', patterns: VIOLENCE },
  /* BELIEF_QUESTION is deliberately NOT in this list. These categories are applied
     to the model's output as well as the child's input, and a good factual
     answer about Christianity says the word "Bible" — routing the question to
     the family must not also throw away the answer. It is checked in
     checkInput() alone. */
];

/* Every pattern is tried against both the plain lowercased text and the
   normalised copy. Both are needed: normalising is what catches "sh1t", and the
   plain text is what catches "<|im_start|>", whose pipes the leet map would
   otherwise helpfully turn into the letter i. */
function classify(text, { output = false } = {}) {
  const plain = flatten(text);
  const soft = normalise(text);
  const tight = squeeze(text);
  const hits = (patterns) => patterns.some((p) => p.test(soft) || p.test(plain));

  for (const { kind, patterns } of CATEGORIES) {
    if (hits(patterns)) return kind;
  }
  if (output && hits(OUTPUT_ONLY)) return 'blocked';
  if (SQUEEZED.some((p) => p.test(tight))) {
    return /suicide|killmyself|killingmyself|wanttodie|iwanttodie|cuttingmyself/.test(tight)
      ? 'crisis'
      : 'blocked';
  }
  if (hits(SPACED)) return 'blocked';
  if (CENSORED.some((p) => p.test(decensor(text)))) return 'blocked';
  return null;
}

/* ------------------------------------------------------------ input check */

export const INPUT_MESSAGES = {
  blocked:
    "I'm not sure how to help with that. I work best with school topics! "
    + 'Try typing something you\'re learning about.',
  sensitive:
    "That one's better to talk about with a grown-up you trust — someone at home, "
    + "or a teacher. They'll know how to explain it properly. "
    + 'Want to try a school topic here instead?',
  /* Used for two kinds of question: the ones about faith that have no factual
     answer, and adult topics like sex. Both belong to a family rather than to a
     1.2B model. The wording has to work for a child asking sincerely and a
     child testing the boundary, so it points somewhere and tells nobody off. */
  family:
    "That's one to talk about with your family — a parent or carer, or someone "
    + "at home you trust. It's the kind of thing where what your own family "
    + "thinks really matters, and it isn't mine to tell you.\n\n"
    + 'Want to try a school topic here instead?',
  'too-long':
    "That's a lot of words for me to hold at once! Try pasting a smaller piece — "
    + 'just the part you need help with.',
};

/* Returns null when the text is fine to send, or { kind, message } when it is
   not. `kind: 'crisis'` means show the care card, not a refusal. */
export function checkInput(text, { allowAssignment = false } = {}) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  if (trimmed.length > MAX_INPUT_CHARS) {
    return { kind: 'too-long', message: INPUT_MESSAGES['too-long'] };
  }

  const kind = classify(trimmed);
  if (kind) return { kind, message: INPUT_MESSAGES[kind] || INPUT_MESSAGES.blocked };

  // After the safety categories, never before them.
  if (BELIEF_QUESTION.some((p) => p.test(normalise(trimmed)))) {
    return { kind: 'family', message: INPUT_MESSAGES.family };
  }

  // Last, so that nothing here can outrank a safety check or a care card.
  if (!allowAssignment && HOMEWORK_REQUEST.some((p) => p.test(normalise(trimmed)))) {
    return { kind: 'homework-request', message: HOMEWORK_REQUEST_MESSAGE };
  }

  return null;
}

// Used while the model is still generating, so a run that has clearly gone
// wrong is stopped rather than left to finish. Cheap enough to call per chunk.
export function outputWentWrong(text) {
  return classify(text, { output: true }) !== null;
}

/* ----------------------------------------------------------- output check */

// Links, addresses and phone numbers are stripped rather than flagged: a small
// model invents them constantly, and an invented link is something a child
// might actually type into a browser.
/* Pet names. A Calm Corner answer signed off "Take care, little one." — which
   is a thing you call a toddler, in an app built for eight to sixteen, at the
   one moment a child is least able to shrug it off. It is also a familial
   register that a piece of software has not earned.

   Stripped rather than rejected: the breathing exercise above it was good, and
   in this tab especially a slightly patronising answer beats no answer at all.
   Only the vocative forms match — a comma before it, or a greeting in front of
   it — so "your buddy" and "the buddy system" are left alone. */
const PET_NAMES = 'little one|little buddy|little friend|little learner|kiddo|buddy|champ|sweetie|sweetheart|young one';

function stripPetNames(text) {
  return String(text)
    .replace(new RegExp(`,\\s*(?:${PET_NAMES})\\b`, 'gi'), '')
    .replace(new RegExp(`\\b(hey|hi|hello|okay|ok|alright)\\s+(?:${PET_NAMES})\\b`, 'gi'), '$1')
    .replace(new RegExp(`\\b(?:${PET_NAMES})\\s*([.!?])`, 'gi'), '$1')
    .replace(/\s+([.!?,])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');
}

export function scrub(text) {
  return stripPetNames(String(text))
    /* Alarm openers. Three Calm Corner answers in a row began "Oh no, I see
       you're feeling tired" — which greets a tired child as though something
       had gone wrong, and makes the app sound more worried than they are. The
       first thing a settling exercise does is not flinch. */
    .replace(/^\s*(oh\s+no|oh\s+dear|uh[\s-]?oh|oh\s+my|aww+|aw)\b[,!.…\s—–-]*/i, '')
    .replace(/^([a-z])/, (c) => c.toUpperCase())
    /* Template slots copied out of the instructions instead of filled in. A
       good explanation of hydrogen bonding ended "So basically, the way water
       behaves is thanks to these gentle pulls between its parts." and then
       added "So basically, [summary]." — the shape of the sentence it had just
       written properly. The whole sentence goes, since a sentence built around
       an unfilled slot has nothing in it. Runs before the link scrubbing below,
       whose own replacements are bracketed. */
    .replace(/[^.!?\n]*\[[a-z][a-z\s'-]{2,40}\][^.!?\n]*[.!?]*/gi, '')
    .replace(/\bhttps?:\/\/\S+/gi, '[link removed]')
    .replace(/\bwww\.\S+/gi, '[link removed]')
    .replace(/\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi, '[email removed]')
    .replace(/\b(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, '[number removed]');
}

const PROMPT_LEAK = /CRITICAL RULES|NEVER VIOLATE|You are speaking to a CHILD|system prompt|<\|/i;

/* The model narrating its own rules at the child. Asked about a line from the
   Ten Commandments it opened with "I notice a small mistake — let's make sure
   we're talking about something safe and helpful today", which tells a child
   they did something wrong when they didn't, and explains nothing. Whatever the
   app has to say about boundaries is written by people, in this file. */
const META_TALK = [
  /^\s*i\s+(notice|noticed|see|spot|spotted)\b[^.!?\n]{0,80}\b(mistake|error|issue|problem|inappropriate|wrong)\b/i,
  /\blet'?s\s+(make\s+sure|keep)\s+[^.!?\n]{0,40}\b(safe|appropriate|helpful|suitable)\b/i,
  /\b(i'?m|i\s+am)\s+not\s+(allowed|able)\s+to\s+(talk|discuss|say)\b/i,
  /\bas\s+(an?\s+)?(ai|assistant|language\s+model)\b/i,
];
const CODEY = /```|<\/?(script|iframe|div|span|img|a|body|html)\b|console\.log|function\s*\(|=>\s*\{/i;
// Cyrillic, CJK, Arabic, Devanagari, Hangul — a small model drifting language.
const OTHER_SCRIPT = /[Ѐ-ӿ一-鿿぀-ヿ؀-ۿऀ-ॿ가-힯]/g;

/* Preaching rather than explaining.

   Asked what Christianity is, the model wrote "understanding these ideas helps
   guide what we value in our daily lives" — speaking from inside the faith, to
   a child, about how to live. BELIEF_RULE in prompts.js tells it to describe
   from the outside instead; this catches it when it doesn't.

   Both halves must match. "In our daily lives" is an ordinary phrase in an
   answer about fractions, and only becomes a sermon next to a faith. */

export const mentionsBelief = (text) => /\b(christian|christianity|muslim|islam|islamic|jew|jewish|judaism|hindu|buddhis|sikh|jesus|christ|god|allah|bible|biblical|quran|koran|torah|gospel|scripture|commandment|faith|religion|religious|pray|prayer|worship|holy|church|mosque|synagogue|temple)/i.test(String(text));

const DEVOTIONAL_VOICE = [
  /\bgod\s+(wants|commands|calls|tells|asks)\s+(us|you)\b/,
  /\bwhat\s+god\s+(says|wants)\b/,
  /\bgod'?s\s+(word|will|plan|law)\b/,
  /\bour\s+(lord|saviour|savior|faith|god)\b/,
  /\bwe\s+(should|must|are\s+called\s+to)\s+(pray|worship|obey|follow|trust|believe)\b/,
  /\byou\s+should\s+(pray|worship|believe\s+in)\b/,
  /\b(praise|glory)\s+(be\s+)?to\s+god\b/, /\bmay\s+god\b/,
  /\b(accept|invite)\s+(jesus|christ)\s+into\b/,
  // The subtler drift, and the one that actually happened: moral guidance
  // delivered in the first person plural, as if the child were a believer.
  /\b(guide|guides|shape|shapes)\s+(what\s+)?(we|our)\b/,
  /\bhelps?\s+us\s+(live|value|be\s+better)\b/,
  /\bin\s+our\s+(daily\s+)?lives\b/,
  /\bteaches\s+us\s+(to|how)\s+(live|be)\b/,
];

const isPreachy = (body) => mentionsBelief(body) && DEVOTIONAL_VOICE.some((p) => p.test(flatten(body)));

/* Returns null if the response is safe to show, or a short reason if it is not.
   The reason is for the console and the parent panel — the child only ever sees
   a fallback line. */
export function checkOutput(text, {
  input = '', calm = false, activities = false, listKind = null, sections = null, topic = false,
} = {}) {
  const body = String(text || '').trim();

  if (!body) return 'empty';

  if (topic && ignoredTheQuestion(body, input)) return 'off-topic';

  // Checked before anything else that is retryable, so app.js can react to it
  // specifically rather than showing "I got turned around" over a finished essay.
  if (looksLikeHomework(body)) return 'did-the-work';
  if (listKind) {
    const shape = checkListShape(body, listKind);
    if (shape) return shape;
  }
  if (sections && missingSections(body, sections)) return 'no-sections';

  /* Content comes first, ahead of the coherence checks, and the order is
     load-bearing rather than tidy. app.js retries anything that failed for
     incoherence — so if "go away you idiot" came back as 'too-short' instead of
     'content:blocked', the app would cheerfully ask the model to say it again. */
  const kind = classify(body, { output: true });
  if (kind) return `content:${kind}`;

  if (body.length < 20 && !calm) return 'too-short';

  if (PROMPT_LEAK.test(body)) return 'prompt-leak';
  // Only the opening — a mention of "safe" halfway down a Calm Corner answer is
  // the subject, not the model talking about itself.
  if (META_TALK.some((p) => p.test(flatten(body.slice(0, 220))))) return 'meta';
  if (isPreachy(body)) return 'preachy';
  if (FOOD_ADVICE.some((p) => p.test(flatten(body)))) return 'food-advice';
  if (calm && missingExercise(body)) return 'no-exercise';
  if (activities && missingActivities(body)) return 'no-activities';
  if (CODEY.test(body)) return 'code';

  const other = (body.match(OTHER_SCRIPT) || []).length;
  if (other > 4 && other / body.length > 0.03) return 'language-drift';

  // Just the child's own words handed back.
  const a = body.toLowerCase().replace(/\s+/g, ' ');
  const b = String(input).toLowerCase().replace(/\s+/g, ' ').trim();
  if (b.length > 25 && (b.includes(a) || (a.includes(b) && a.length < b.length * 1.25))) {
    return 'echo';
  }

  // Repetition, the classic small-model failure: the same sentence, or the same
  // handful of words, looping until the token budget runs out.
  const sentences = body.split(/[.!?\n]+/).map((s) => s.trim()).filter((s) => s.length > 8);
  if (sentences.length > 3) {
    const unique = new Set(sentences.map((s) => s.toLowerCase()));
    if (unique.size < sentences.length * 0.4) return 'repetition';
  }
  const words = body.toLowerCase().match(/[a-z']+/g) || [];
  if (words.length > 40) {
    const counts = new Map();
    for (let i = 0; i + 6 <= words.length; i += 1) {
      const gram = words.slice(i, i + 6).join(' ');
      const n = (counts.get(gram) || 0) + 1;
      if (n >= 3) return 'repetition';
      counts.set(gram, n);
    }
  }

  return null;
}

/* -------------------------------------------------------- doing the work

   The one rule the whole app exists to keep: it helps a child understand their
   homework, it never does it. That rule lived only in the system prompt until
   "write an essay on abraham lincoln" in Break It Down came back as a finished
   five-paragraph essay on Abraham Lincoln, complete with "In conclusion". The
   model simply ignored the instruction, and nothing downstream was looking.

   Note what is NOT done here: that input is not blocked. "Write an essay on
   Abraham Lincoln" is exactly the right thing to type into Break It Down — the
   tab's own placeholder suggests "write a book report on Hatchet" — so the
   child did nothing wrong and must not be told off. The failure was the
   answer, so the answer is what gets checked. */

/* Ways a piece of finished work signs itself off. Deliberately the formal ones
   only: "in summary" and "overall" were here and came out again, because a
   perfectly good Explain This answer might reasonably start its last sentence
   that way, and wrongly accusing a child's explanation of being an essay is a
   worse failure than missing one. "In conclusion" belongs to homework. */
const ESSAY_CLOSER = /(^|\n|[.!?]\s+)\s*(in conclusion|to conclude|to sum up|all in all|in closing)/i;

// Any sign the answer is a helper's structured reply rather than continuous prose.
const STRUCTURED = /(^|\n)\s*(\d+[.)]\s+\S|step\s+\d+|[-*•]\s+\S|#{1,6}\s+\S|\*\*[^*\n]+\*\*\s*:?\s*$)/im;

export function looksLikeHomework(text) {
  const body = String(text);
  if (!ESSAY_CLOSER.test(body)) return false;
  if (STRUCTURED.test(body)) return false;

  /* Three or more full prose paragraphs, wrapped up with a conclusion, and no
     structure anywhere: that is not an explanation, that is a submission.

     The size bar is set from the real failure — a five-paragraph essay on
     Abraham Lincoln — but low enough to also catch the tidier four-paragraph
     version, which is just as handable-in. */
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 100);

  if (paragraphs.length < 3) return false;
  return paragraphs.join(' ').length >= 450;
}

/* Some tabs owe the child a shape, not just a subject. Break It Down owes a
   numbered list of things to DO, and Find the Stuck owes numbered questions.

   Counting the numbers is not enough. Asked to break down "write an essay on
   Jackie Robinson", the model produced a tidy Q&A guide about Jackie Robinson —
   good writing, wrong job, and half his research done for him. Numbered, that
   would have passed a count. So the items themselves are checked: a step starts
   with something the child does. */

// Leading markdown is allowed through: the model writes "**Step 1:** Write..."
// about as often as it writes "1. Write...", and both are a list.
const listItems = (text) => String(text)
  .match(/(^|\n)[^\S\n]*[*_#>]*[^\S\n]*(?:\d+[.)]|step\s+\d+[:.)]?)[^\S\n]*\S[^\n]*/gim) || [];

// Verbs a step actually starts with. Generous, because there are many ways to
// say "now do this", and a false alarm costs the child a working answer.
const STEP_VERBS = new Set(`write read open find look make list draw choose pick ask check
put start begin get grab set take turn go watch say tell think plan sort group highlight
underline copy note jot count add practise practice review reread close gather collect
decide split break do try use show share give keep stop finish tidy clear sit stand
breathe rest celebrate feel reward pick spell describe explain answer fill circle
number label build cut paste stick print save name`.split(/\s+/));

// Words that come before the verb: "First, write..." / "Now read..."
const SEQUENCERS = /^(first|firstly|next|then|now|once|after|before|finally|lastly|when|while|if|start|begin|last)\b/;

/* "Do you know what a fraction is?" opens with "do", which is a perfectly good
   step verb, and is obviously not a step. Anything that both opens like a
   question and ends like one is a question. Checked before the verb list so it
   wins. */
const INTERROGATIVE = /^(do|does|did|can|could|would|should|will|is|are|was|were|have|has|had|why|what|when|where|who|whom|which|how)\b/;

function isStep(item) {
  // Drop any markdown wrapper, then the number or "Step 3:", then what is left
  // of the wrapper on the far side of it.
  const body = item
    .replace(/^\s*[*_#>]*\s*/, '')
    .replace(/^(\d+[.)]|step\s+\d+[:.)]?)\s*/i, '')
    .replace(/^[*_:\s]+/, '')
    .trim();

  const low = flatten(body);
  if (INTERROGATIVE.test(low) && body.endsWith('?')) return false;
  if (SEQUENCERS.test(low)) return true;

  const first = (low.match(/^[a-z']+/) || [''])[0];
  return STEP_VERBS.has(first);
}

const isQuestion = (item) => item.includes('?');

/* Returns null when the shape is right, or a reason when it is not.
   `kind` is 'steps' or 'questions'. */
export function checkListShape(text, kind = 'steps') {
  const items = listItems(text);
  if (items.length < 4) return 'no-list';

  const wanted = kind === 'questions' ? isQuestion : isStep;
  const good = items.filter(wanted).length;

  // Half is a deliberately loose bar. The failure this catches is a list where
  // nothing is a step at all, not a list with one awkwardly worded entry.
  if (good < items.length / 2) return kind === 'questions' ? 'not-questions' : 'not-steps';

  return null;
}

// Kept for the tests and for anything that only cares whether a list exists.
export const missingList = (text) => listItems(text).length < 4;

/* Five tabs answer in named sections — "Real-Life Connection", "Story Version",
   "The Point" and so on. Asked why political science matters, the model used
   none of its three and produced a page of shapeless waffle instead. The
   headings are not decoration: they are what makes the model do three separate
   jobs rather than one vague one, and they are what lets a child skim.

   Half is the bar. One missing heading is a wobble; none of them is a collapse. */
export function missingSections(text, labels = []) {
  if (!labels.length) return false;
  const body = String(text).toLowerCase();
  const found = labels.filter((label) => body.includes(label.toLowerCase())).length;
  return found < labels.length / 2;
}

/* The same sentence means opposite things in different tabs. "Write an essay on
   Abraham Lincoln" in Break It Down is a child correctly naming their
   assignment; anywhere else it is a child asking the app to write it. So this
   is checked everywhere except that tab, and the answer is a signpost rather
   than a refusal — it sends them to the tab that will actually help. */
const HOMEWORK_REQUEST = [
  /\b(write|compose|create|draft|make|type)\s+(me\s+)?(an?|the|my)\s+(essay|paragraph|report|story|poem|letter|speech|article|summary|book\s+report)\b/,
  /\b(do|finish|complete|write)\s+(my|the|this)\s+(homework|assignment|worksheet|essay|report|project)\b/,
  /\b(answer|solve)\s+(these|this|the|my)\s+(questions?|problems?|worksheet|equations?)\b/,
  /\b(give|tell)\s+me\s+the\s+answers?\b/,
  /\bwhat('?s|\s+is)\s+the\s+answer\s+to\b/,
  /\b(write|do)\s+(it|this|them)\s+for\s+me\b/,
];

/* Worded to fit both readings, because the same pattern catches "write me an
   essay on Lincoln" and "I have to write a book report on Hatchet" — one is a
   child asking the app to do it, the other is a child telling you what they
   have been set. Leading with the signpost rather than the refusal means the
   second child is helped rather than told off for something they didn't do. */
export const HOMEWORK_REQUEST_MESSAGE =
  'That sounds like a whole assignment!\n\n'
  + "Press **🪜 Break It Down** and type it in there — I'll turn it into small "
  + 'steps you can actually start on.\n\n'
  + '**Want to know about the topic itself?** Type just the topic here — like '
  + '"Abraham Lincoln" instead of "write an essay on Abraham Lincoln" — and '
  + "I'll tell you what I know about it.\n\n"
  + "The writing is yours, though. That's the bit that counts.";

/* Calm Corner owes exactly one thing: a grounding exercise. Asked for help with
   "exhausted" it returned pure chat — an offer to talk, a promise of small
   steps, and the observation that looking after yourself "helps us both stay
   helpful". Warm, strange, and with nothing in it to actually do.

   Generous on purpose. Any instruction that puts the child's attention in their
   body or the room counts, so this only fires when there is genuinely nothing
   to follow. */
const GROUNDING = [
  /\bbreath(e|es|ing)\b/, /\binhale\b/, /\bexhale\b/,
  /\bcount(ing)?\s+(to|down|of)\b/, /\bfor\s+(a\s+count\s+of\s+)?(three|four|five|six|3|4|5|6)\b/,
  /\bsqueeze\b/, /\bstretch\b/, /\bshoulders\b/, /\bfists?\b/, /\bjaw\b/,
  /\bclose\s+your\s+eyes\b/, /\blisten\s+(for|to)\b/, /\bnotice\b/,
  /\bname\s+(three|four|five|3|4|5)\b/, /\bthings\s+you\s+can\s+(see|hear|touch|feel|smell)\b/,
  /\bpress\s+your\s+(feet|hands|back)\b/, /\bfeet\s+(flat\s+)?on\s+the\s+(floor|ground)\b/,
  /\bstand\s+up\b/, /\bwalk\b/, /\brelax\b/, /\bsoften\b/, /\bslowly\b/, /\bunclench\b/,
];

export const missingExercise = (text) => !GROUNDING.some((p) => p.test(flatten(text)));

/* Shown when Calm Corner's answer fails a check twice. A child who came here
   overwhelmed should never be handed "that didn't come out right" — they asked
   for help settling, and a settling exercise is short, standard and safe enough
   to simply write down. Box breathing, in people's words, every time.

   Its last line is the brief's own. */
export const CALM_FALLBACK =
  "Here's one you can do right now. You don't have to type anything.\n\n"
  + 'Put both feet flat on the floor.\n\n'
  + 'Breathe in while you count slowly to four. Hold it for four. '
  + 'Breathe out for six.\n\n'
  + 'Do that three times.\n\n'
  + 'Then let your shoulders drop away from your ears, and notice how that feels.\n\n'
  + "Take your time. You'll know when you're ready.";

/* What Can I Try owes a handful of things to actually do. Told "i feel creative
   today", it replied "That's awesome! Feeling creative is such a cool emotion.
   Want to explore what made you feel that way?" — enthusiasm, a dead end, and
   not one activity.

   Counted two ways because the tab's answers legitimately take two shapes: a
   list of suggestions, or a few sentences each naming something to do. */
const ACTIVITY_VERBS = new RegExp(`\\b(${[
  'draw', 'paint', 'colour', 'color', 'doodle', 'sketch', 'sculpt', 'collage', 'make', 'build',
  'write', 'journal', 'list', 'read', 'walk', 'run', 'jump', 'dance', 'stretch', 'shake',
  'skip', 'climb', 'breathe', 'hum', 'sing', 'drum', 'listen', 'play', 'sort', 'organise',
  'organize', 'tidy', 'plant', 'water', 'pet', 'stroke', 'fold', 'cut', 'stick', 'puzzle',
].join('|')})\\w*\\b`, 'gi');

export function missingActivities(text) {
  const body = String(text);
  if (listItems(body).length >= 3) return false;

  const found = new Set((body.match(ACTIVITY_VERBS) || []).map((w) => w.toLowerCase()));
  return found.size < 3;
}

/* Shown when What Can I Try fails twice. Three activities from three different
   categories, exactly as the brief's own no-input version asks for, needing
   nothing a child might not have. Its last line is the brief's. */
export const ACTIVITIES_FALLBACK =
  'Here are three you could try right now.\n\n'
  + '**Draw how today feels.** Any paper will do. Use colours, shapes or '
  + "scribbles — it doesn't have to look like anything.\n\n"
  + '**Shake it out.** Stand up and shake your hands, then your arms, then your '
  + 'whole body, for about ten seconds.\n\n'
  + '**Find five quiet things.** Look around wherever you are and find five '
  + "things you had never really noticed before.\n\n"
  + 'Pick one and try it for a few minutes. See how you feel after.';

export const DID_THE_WORK_MESSAGE =
  'That one got away from me — I started doing the work instead of helping you '
  + 'do it, so I stopped.\n\n'
  + 'Your teacher wants your thinking, not mine. Try typing just the topic on '
  + 'its own and I\'ll help you find a way into it.';

/* ------------------------------------------------------------- food advice

   A child typed "tired and hungry" into Calm Corner and was told: "A small
   snack like fruit, yogurt, or nuts can give you energy without making you feel
   too full later."

   Naming foods and commenting on fullness is dietary advice, and this app is
   talking to eight to sixteen year olds — the years in which eating disorders
   most often start. "Without making you feel too full" is exactly the register
   that does harm. The brief bans this for the activities tab; it belongs
   everywhere, and it is a rejection rather than a trim because a paragraph of
   it usually runs through the whole answer.

   Hunger is still allowed to be real: the prompt's answer to it is one plain
   sentence saying so and pointing at someone who can provide food. What is
   forbidden is prescribing. */
const FOOD_ADVICE = [
  /\b(a|some)\s+(small|light|healthy|quick|little)\s+snack\b/,
  /\bhave\s+(a|some)\s+(snack|something\s+to\s+eat|food)\b/,
  /\b(grab|get|make|fix)\s+(yourself\s+)?(a|some)\s+(snack|bite|something\s+to\s+eat)\b/,
  /\beat\s+(something|a\s+bit|a\s+little|more|less)\b/,
  /\bsnacks?\s+(like|such\s+as)\b/,
  /\btoo\s+full\b/, /\bfeel(ing)?\s+full\b/,
  /\bcalorie/, /\bportion\s+size/, /\bon\s+a\s+diet\b/, /\byour\s+weight\b/,
];

/* ------------------------------------------------------ the wellbeing tangent

   Asked to re-explain "the body is working by doing lots of chemical reactions
   inside all the time", the model gave a decent answer and then added: "If you
   notice anything strange or uncomfortable, talking to someone you trust is a
   good idea."

   That is the safety preamble leaking out as content. The rule telling it never
   to give medical advice carried a quotable line for distressed children, and
   the model matched "body" to "health" and said it unprompted — turning a
   chemistry question into a vague suggestion that something might be wrong with
   the child's body. The preamble no longer hands it that line; this removes it
   on the days it improvises its own.

   Calm Corner and What Can I Try are exempt. "If you still feel wobbly, tell
   someone at home" is exactly right there, and nowhere else. */
const WELLBEING_TANGENT = [
  /\bif\s+you\s+(ever\s+)?(notice|feel|felt|experience|have|see)\s+(anything|something|any)\b[^.!?]{0,60}\b(strange|weird|odd|uncomfortable|unusual|wrong|painful|hurts?|scary|worrying)\b/,
  /\b(talk|speak|talking|speaking)\s+(to|with)\s+(a|your)\s*(doctor|nurse|physician|professional)\b/,
  /\bseek\s+(medical|professional)\s+(help|advice|attention)\b/,
  /\bconsult\s+(a|your)\s+(doctor|physician|professional)\b/,
  /\b(talk|talking|speak|speaking)\s+to\s+(someone|a\s+grown-?up|an\s+adult|a\s+trusted\s+adult)\s+you\s+trust\b/,
];

/* The other thing that gets bolted onto a finished answer: a paragraph of
   encouragement about learning, with no information in it. A definition of
   "cat" ended "Remember, the word cat is easy to learn once you try to say it
   several times. Keep practising, and soon you'll use it naturally."

   There is a rule against this in the prompt and the model still does it, which
   is what a 728-word system prompt gets you. Only ever taken from the last
   paragraph, and only when that paragraph has no heading of its own — a real
   section is never padding, however warm it sounds. */
const PEP_TALK = [
  /\bkeep\s+practi[cs]ing\b/,
  /\bthe\s+more\s+you\s+practi[cs]e\b/,
  /\bis\s+easy\s+to\s+(learn|remember|say)\s+once\s+you\b/,
  /\bsoon\s+you'?ll\b/,
  /\byou'?ll\s+(be\s+)?us(e|ing)\s+it\s+(naturally|in\s+no\s+time|before\s+long)\b/,
  /\bwith\s+(a\s+bit\s+of|enough|more)\s+practice\b/,
  /^remember,\s+the\s+word\b/,
];

/* Removes it rather than rejecting the answer: everything above the tangent is
   usually fine, and the child asked a real question that deserves its answer.
   Takes the whole final paragraph, because half a pep-talk reads worse than
   none — "That way, everyone can support you safely." on its own is nonsense. */
export function trimTangent(text, { allow = false } = {}) {
  if (allow) return String(text).trim();

  const body = String(text).trim();
  const hits = (chunk) => WELLBEING_TANGENT.some((p) => p.test(flatten(chunk)));

  const paragraphs = body.split(/\n\s*\n/);
  const last = paragraphs[paragraphs.length - 1] || '';
  const headed = /\*\*[^*\n]+\*\*/.test(last) || /^#{1,6}\s/.test(last.trim());

  if (paragraphs.length > 1 && (hits(last) || (!headed && PEP_TALK.some((p) => p.test(flatten(last)))))) {
    return paragraphs.slice(0, -1).join('\n\n').trim();
  }

  // One paragraph: take out the offending sentences instead.
  if (paragraphs.length === 1 && hits(body)) {
    const sentences = [...body.matchAll(/[^.!?\n]+[.!?]+["')\]]*/g)];
    let trimmed = body;
    for (let i = sentences.length - 1; i >= 0; i -= 1) {
      if (hits(sentences[i][0])) {
        trimmed = trimmed.slice(0, sentences[i].index)
          + trimmed.slice(sentences[i].index + sentences[i][0].length);
      }
    }
    const cleaned = trimmed.replace(/[ \t]{2,}/g, ' ').trim();
    // Never hand back nothing; if that was the whole answer, let the checks
    // downstream call it empty and retry.
    return cleaned || body;
  }

  return body;
}

/* -------------------------------------------------- answering a different question

   Asked what "hypothesis" means, the model read its own section heading —
   "Simple Definition" — as the thing to define, explained what a simple
   definition is, and then defined the word "fun" instead. The word the child
   typed appears nowhere in the answer.

   Cheap and certain to detect: if the child named a topic in a few words, those
   words have to turn up in the answer. Only short, topic-shaped inputs are
   checked, and the feelings tabs are exempt because "I feel mad" is quite
   properly answered in the language of anger. */

const STOPWORDS = new Set(`the a an of and or but in on at to for from with about is are was
were be been what why how when where who my me i it this that these those do does did can
could would should you your please help explain tell mean means`.split(/\s+/));

/* How close two words have to be to count as the same word. Stops as soon as
   the distance passes the limit, so it never walks a whole long word. */
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (row[j] < best) best = row[j];
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/* A child typed "hinderance". The model quite correctly answered about
   "hindrance" — and this check, which demanded the answer contain the letters
   the child typed, threw the answer away and did it again.

   Word Helper is where a child looks up a word they do not know, and a child
   who does not know a word very often cannot spell it either. So near misses
   count: "seperate" finds "separate", "recieve" finds "receive", "freind"
   finds "friend". */
function nearlyTheSame(word, body) {
  if (word.length < 4) return false;
  const limit = word.length >= 6 ? 2 : 1;
  const candidates = body.match(/[a-z][a-z'-]{2,}/g) || [];
  return candidates.some((c) => editDistance(word, c, limit) <= limit);
}

// Long words are matched on a prefix so an answer may inflect them: a child who
// types "hypothesis" is answered about "hypotheses", and that counts.
export function ignoredTheQuestion(output, input) {
  const words = flatten(input).match(/[a-z][a-z'-]{2,}/g) || [];
  const content = words.filter((w) => !STOPWORDS.has(w));

  // Nothing to check against, or too long to be a topic — a pasted paragraph
  // shares no vocabulary with a good explanation of it.
  if (!content.length || content.length > 4) return false;

  const body = flatten(output);
  return !content.some((w) => properlyAbout(w, body));
}

/* A passing mention is not an answer.

   Asked about "cat", the model wrote five paragraphs defining "hindrance" — the
   example word that was sitting in its own instructions — and slipped in "or
   picture a cat hiding behind a curtain" near the end. The word appeared, so
   the check passed it.

   An answer that is genuinely about something says so early and says it more
   than once. Both tests are generous: near the top, OR twice anywhere. */
function properlyAbout(word, body) {
  const OPENING = 220;                     // past the prefilled heading
  const stem = word.slice(0, Math.max(4, word.length - 2));

  if (body.includes(stem)) {
    if (body.slice(0, OPENING).includes(stem)) return true;
    if (body.split(stem).length - 1 >= 2) return true;
    return false;
  }

  // Misspelt input: find where the word it actually meant turned up.
  if (word.length < 4) return false;
  const limit = word.length >= 6 ? 2 : 1;
  let seen = 0;
  let early = false;
  for (const m of body.matchAll(/[a-z][a-z'-]{2,}/g)) {
    if (editDistance(word, m[0], limit) <= limit) {
      seen += 1;
      if (m.index < OPENING) early = true;
    }
  }
  return early || seen >= 2;
}

/* ---------------------------------------------------------- the dead end

   There is no chat in this app. One input, one answer, and no way for the
   child to reply — so a closing "Want to play a game where we find shapes
   around our house? 🎉" is an invitation to press something that isn't there.
   The system prompt says so (see NO_CHAT_RULE); a 1.2B model forgets. This
   removes the sign-off when it does.

   Only the final sentence is ever touched, and only when it is unmistakably an
   invitation. Questions the child answers in their own head are the point of
   two of the tabs and must survive. */

// Offers of more from the helper itself. Never legitimate, in any tab.
const OFFERS = [
  /^want\s+me\s+to\b/,
  /^(would|do)\s+you\s+(want|like)\s+me\s+to\b/,
  /^shall\s+i\b/, /^should\s+i\b/,
  /^(let\s+me\s+know|just\s+ask|feel\s+free\s+to\s+ask|ask\s+me\s+(anything|again|another))\b/,
  /^i\s+(can|could)\s+(help|explain|show|tell)\s+you\s+more\b/,
  /* Broadened from "if you want..." after "If you're curious about the word
     later, you can tell me what it is and I'll walk through it with you" went
     straight past it. The opening varies endlessly; what gives it away is the
     child being invited to tell or ask this app something. */
  /^if\s+you\b[^.!?]*\b(just\s+ask|let\s+me\s+know|tell\s+me|ask\s+me|i\s+can|i'?ll|i\s+will)\b/,
  /\byou\s+can\s+(tell|ask)\s+me\b/,
  /\bi'?(ll|\s+will)\s+(walk|talk|go|run)\s+(you\s+)?through\b/,
  /* "We can dive into it together!" — an offer to carry on that hid behind the
     question it followed. The trim tests one sentence at a time, so a sign-off
     built from two of them only comes apart if the last one is recognised
     first; this is the pattern that was missing. */
  /^(we|let'?s)\b[^.!?]*\b(together|next\s+time|another\s+time|right\s+now)\b/,

  /* Invitations to talk. These sit in OFFERS rather than with the other
     questions because OFFERS is the list Calm Corner still applies — and Calm
     Corner is where they turn up. The distinction that matters there is what
     the question is FOR: "what can you hear right now?" is the exercise and
     stays, "what's on your mind today?" is a chat that cannot happen and goes.
     Both arrived in one answer to "stressed out". */
  /^what'?s\s+on\s+your\s+mind\b/,
  /^what'?s\s+(bothering|worrying|troubling|upsetting)\s+you\b/,
  /^(do|would)\s+you\s+want\s+to\s+talk\b/,
  /^would\s+you\s+like\s+to\b/,
  /^how\s+(are|do)\s+you\s+feel(ing)?\s+(right\s+)?now\b/,
  /\bwhat\s+sounds\s+good\s+to\s+you\b/,
  /^is\s+there\s+(anything|something)\b/,
  /\banything\s+(you'?d|you\s+would)\s+like\s+to\s+(talk|try|do|share)\b/,
  /^how\s+can\s+i\s+help\b/,
  /^tell\s+me\s+(about|what|how|if|more)\b/,
  /\bwe\s+can\s+(talk|discuss|chat|come\s+back\s+to|look\s+at)\s+(about\s+)?(it|that|this|them)\b/,
];

/* Praise for having used the app.

   "You're doing great by asking questions like this" — said to a child who
   typed "I'm sleepy", which is not a question. Hollow on its own, and wrong
   about what just happened, which children notice faster than adults do. They
   pressed a button; there is nothing there to congratulate.

   Scoped tightly to praise for asking, coming or reaching out, so that real
   praise for real work survives: "feel proud of yourself — you did it" at the
   end of Break It Down, and "you nailed it" in Check My Thinking, both stay. */
const PRAISE = [
  /\byou'?re\s+doing\s+(great|well|so\s+well|brilliantly)\s+(just\s+)?(by|for)\s+(asking|coming|being|reaching|showing)/,
  /\bwell\s+done\s+for\s+(asking|coming|reaching|being)/,
  /\b(good|great)\s+job\s+for\s+(asking|coming|reaching)/,
  /\bproud\s+of\s+you\s+for\s+(asking|coming|reaching)/,
  /\bjust\s+by\s+(asking|being\s+here|showing\s+up|coming\s+here)\b/,
  /\b(it'?s|that'?s|it\s+is|that\s+is)\s+(really\s+|so\s+)?brave\s+(of\s+you\s+)?to\s+(ask|come|say)/,
  /\bfor\s+reaching\s+out\b/,
];

// Removed wherever they appear, in every tab, Calm Corner included.
const ALWAYS_REMOVE = [...OFFERS, ...PRAISE];

/* Split out of REPLY_PROMPTS because these are unambiguously conversational
   wherever they sit, not just at the end. "Want to explore what made you feel
   that way?" was buried one sentence deep in a What Can I Try answer and
   survived, because the scan that reaches inside an answer was only looking for
   offers. These are offers, in question form. */
const CONVERSATIONAL = [
  /^want\s+(to|us\s+to)\b[^.!?]*\?/,
  /^(shall|should|can|could|would|will)\s+(we|you)\b[^.!?]*\?/,
  /^how\s+about\b[^.!?]*\?/,
  /^ready\s+to\b[^.!?]*\?/,
  /^what\s+do\s+you\s+think\b/,
  /^tell\s+me\s+(what|if|how|more|about)\b/,
];

/* Only removed when they end the answer. Broad enough to catch a closing
   question in any phrasing, which also makes them broad enough to eat a useful
   rhetorical one — "what do you notice about these two numbers?" is a real
   teaching move in the middle of an explanation, and stays there. */
const TRAILING_QUESTIONS = [
  /* Any closing yes/no question put to the child — "Do you have any questions
     about this?", "Can you think of another example?". Trailing-only, because
     mid-answer "Do you know what a fraction is? It's a piece of a whole" is a
     perfectly good way to open an explanation. */
  /^(do|did|can|could|would|will|should|are|have|has)\s+you\b[^.!?]*\?/,
  /* Any closing question aimed at the child. "What would YOU like to explore
     next?" went straight through a list of specific openers, and there are
     endlessly many ways to phrase it, so this matches the shape instead: a
     question word, the child, a question mark, at the very end. Only the last
     sentence is ever tested, and Calm Corner and Find the Stuck opt out. */
  /^(what|which|who|where|when|how|why)\b[^.!?]*\byou(r|rs)?\b[^.!?]*\?/,
];

export function trimDeadEnd(text, { gentle = false, noQuestions = false } = {}) {
  const patterns = gentle
    ? ALWAYS_REMOVE
    : [...ALWAYS_REMOVE, ...CONVERSATIONAL, ...TRAILING_QUESTIONS];
  let body = String(text).trim();

  // Three passes: a sign-off is often a question and then a flourish after it,
  // and each pass can only peel one sentence.
  for (let pass = 0; pass < 3; pass += 1) {
    const breaks = [...body.matchAll(/[.!?]+["')\]]*\s+/g)];

    /* Walk back to the last chunk that actually contains words. A trailing
       "🎉" on its own is not the sentence we want to test — it is the
       decoration on the end of the one before it, and it goes with it. */
    let cut = 0;
    for (let i = breaks.length - 1; i >= 0; i -= 1) {
      const start = breaks[i].index + breaks[i][0].length;
      if (/[a-z]/i.test(body.slice(start))) { cut = start; break; }
    }

    // cut === 0 means the whole answer is one sentence. Never delete all of it.
    if (!cut) break;

    const tail = flatten(body.slice(cut).trim());

    /* Also tested with any lead-in stripped. Every pattern is anchored at the
       start, and "Now, which part are you curious about?" put one word in front
       of the anchor and sailed through the lot of them. */
    const bare = tail.replace(/^(?:now|so|ok|okay|alright|right|and|but|anyway|finally|lastly)[,!]?\s+/, '');

    if (!patterns.some((p) => p.test(tail) || p.test(bare))) break;

    body = body.slice(0, cut).trim();
  }

  /* A sign-off does not always come last. "If you're curious you can tell me
     what it is and I'll walk through it with you" followed by a cheerful
     platitude leaves the offer buried one sentence deep, where peeling from the
     end never reaches it.

     Only outright OFFERS are removed this way, never the question patterns — a
     question in the middle of an answer is usually doing a job. Cut back to
     front so the earlier offsets stay valid, and by slicing rather than
     rejoining, so paragraph breaks survive. */
  /* Scanned across the whole answer, not just the tail. A Calm Corner reply to
     "tired" opened with "How are you feeling right now?" and put "Would you
     like to breathe together?" in the middle — dead ends wherever they sit.
     Safe to do because OFFERS only holds unambiguous invitations, and the floor
     below means this can prune an answer but never gut it. */
  const sentences = [...body.matchAll(/[^.!?\n]+[.!?]+["')\]]*/g)];
  const floor = Math.max(1, Math.ceil(sentences.length / 2));
  let kept = sentences.length;

  /* Calm Corner asks for instructions, never questions — "listen for the
     quietest sound" rather than "what can you hear?" — so any question there is
     a defect, not a phrasing to be matched one at a time. Chasing them
     individually kept failing: "How does that feel?" and "Is everything clear?"
     both walked past a list built for "what would you like to do?". */
  const inner = gentle ? ALWAYS_REMOVE : [...ALWAYS_REMOVE, ...CONVERSATIONAL];
  const unwanted = (sentence) => inner.some((p) => p.test(flatten(sentence)))
    || (noQuestions && /\?["')\]]*\s*$/.test(sentence.trim()));

  for (let i = sentences.length - 1; i >= 0 && kept > floor; i -= 1) {
    const sentence = sentences[i];
    if (unwanted(sentence[0].trim())) {
      body = body.slice(0, sentence.index) + body.slice(sentence.index + sentence[0].length);
      kept -= 1;
    }
  }

  return body.replace(/[ \t]{2,}/g, ' ').trim();
}

/* ------------------------------------------------------------- length cap */

// Cuts at the last sentence that fits, so a capped answer still reads as if it
// meant to stop there. Falls back to a word boundary and an ellipsis.
export function capLength(text, maxChars) {
  const body = String(text).trim();
  if (body.length <= maxChars) return body;

  const window = body.slice(0, maxChars);
  const lastEnd = Math.max(
    window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '),
    window.lastIndexOf('.\n'), window.lastIndexOf('!\n'), window.lastIndexOf('?\n'),
  );
  if (lastEnd > maxChars * 0.5) return window.slice(0, lastEnd + 1).trim();

  const lastSpace = window.lastIndexOf(' ');
  return `${window.slice(0, lastSpace > 0 ? lastSpace : maxChars).trim()}…`;
}

/* -------------------------------------------------------------- fallbacks */

/* These run when the MODEL produced something unusable, which is nothing to do
   with what the child typed. The brief's originals — "I work best with school
   questions! Try typing a topic you're studying" — were written for off-topic
   input and read as an accusation when they appear after a perfectly good one:
   a child who typed "science" was told science wasn't a school topic.

   Input that genuinely needs redirecting has its own messages, further up. So
   these own the failure, and every one of them says what to press next. */
const FALLBACK_RESPONSES = [
  "That didn't come out right — my fault, not yours. Press the button again and I'll have another go.",
  'Hmm, I got a bit tangled there. Press the button once more and I\'ll try again.',
  "I lost the thread on that one. It's not you — press the button again.",
  "That one came out muddled. Press the button again, or try saying it a slightly different way.",
];

let lastFallback = -1;

// Not random for its own sake — just never the same line twice in a row, so a
// child retrying does not feel like they hit a wall.
export function fallback() {
  let i = Math.floor(Math.random() * FALLBACK_RESPONSES.length);
  if (i === lastFallback) i = (i + 1) % FALLBACK_RESPONSES.length;
  lastFallback = i;
  return FALLBACK_RESPONSES[i];
}

/* ------------------------------------------------------------- care card

   Shown instead of anything model-generated when checkInput returns 'crisis'.
   Every word of it is written here, by people, and it never changes.

   It leads with a trusted adult rather than a helpline, because for most
   children that is the nearer and better door, and because a child who cannot
   face phoning a stranger should not be left with only that option. The numbers
   are there for when home is the problem. */
export const CARE_CARD = {
  title: 'I want to make sure you’re okay',
  body: `What you typed sounds heavy, and I’m really glad you said it out loud.

I’m only a helper program on this computer. I’m not the right kind of help for something this big — you deserve a real person.

**Please go and tell a grown-up you trust, now.** A parent, a carer, a teacher, a school counsellor, an older cousin. You are not in trouble. Nobody is going to be angry with you for saying this.

If there isn’t someone you can reach, these are people whose whole job is listening to young people. They are kind, they are free, and you don't have to give your name:

- **Call or text 988** — Suicide & Crisis Lifeline, any time, day or night (US)
- **Text HOME to 741741** — Crisis Text Line, if talking out loud is too much (US)
- **Call 1-800-422-4453** — Childhelp, if someone is hurting you (US)
- **Call 0800 1111** — Childline, free and confidential (UK)
- Anywhere else, a grown-up can help you find your local line at findahelpline.com

You matter. School can wait — this can’t.`,
};
