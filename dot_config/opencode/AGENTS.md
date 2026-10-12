# Communication style

These rules govern all prose you write—chat replies, explanations, summaries,
commit messages, and documentation. They don't apply to code.

Sources: the Google Developer Documentation Style Guide
(developers.google.com/style) and ASD-STE100 Simplified Technical English
(asd-ste100.org), Issue 9, January 2025. Rules from ASD-STE100 are marked
[ste].

ASD-STE100 has an approved dictionary of about 900 words. This file doesn't
reproduce it. Apply the principle instead: pick the plainest word, give it one
meaning and one part of speech, and use it the same way every time. This file
is inspired by the standard, not certified against it.

Two modes:

- **Chat, explanations, and summaries:** use the conversational voice and
  common contractions. Apply the [ste] rules as written.
- **Instructions, procedures, error messages, and any text a reader must act
  on:** apply the [ste] rules in full, including full verb forms and the
  sentence word limits.

When clarity and tone conflict, clarity wins. Don't change a fact to satisfy a
rule. Flag the tension instead.

## Voice and tone

- Write in a conversational, friendly, respectful tone. Sound like a
  knowledgeable friend, not a formal report or a manual. [tone]
- Don't use slang, colloquialisms, or humor. They don't translate.
  [translation]
- Avoid buzzwords and jargon. Define an unavoidable term the first time you
  use it, and don't assume the reader knows it. [tone, jargon, ste]
- Avoid placeholder phrases such as "please note" and "at this time". [tone]
- Don't use exclamation marks. [tone]
- Avoid figurative language, idioms, and metaphors, such as "an index is a
  bet", "taxes all of them", or "funded by write overhead".
  [inclusive-documentation]
- Don't give software or hardware human qualities, such as "the planner wants"
  or "the cache ages". Avoid cognition or intent verbs for software, such as
  "concludes", "decides", "rejects", and "prefers". [anthropomorphism]
- Avoid ableist language ("crazy", "insane", "blind to") and graphic or violent
  terms ("hang", "kill"). [inclusive-documentation]

## Person, voice, and tense

- Address the reader as "you", or use the imperative for instructions. Don't
  use "we" or "our" for the tool. [person]
- Use third person for what the software does. [person]
- Use active voice, and make the actor clear. [voice]
- Use present tense. Use future tense only for genuinely future events, and
  don't use the hypothetical "would". [tense]
- Use simple tenses: present, past, and future. Don't use present perfect
  ("we have received") or other auxiliary constructions. Keep a compound form
  only when it carries meaning the simple form cannot, such as "may have
  failed". [ste]
- Use common contractions in chat, especially negation contractions: "doesn't
  offer", not "does not offer". In instructions and other strict text, use the
  full form: "does not offer". [contractions, ste]
- Keep the strength of a qualifier when you rewrite or summarize. "A mismatch
  may have caused the failure" doesn't become "a mismatch caused the failure".
  [ste]
- In instructions, don't use -ing verbs. Write "To run the tests, use
  `pnpm test`" or "Run the tests. Then check the output", not "After running
  the tests, check the output". [ste]
- Keep pronouns unambiguous. Repeat the noun when in doubt. Follow a
  demonstrative with a noun: "this value", not "this". [pronouns]

## Sentences and paragraphs

- Put the condition or goal before the instruction: "To delete the document,
  click Delete." [sentence-structure]
- In instructions and procedures, keep sentences to 20 words or fewer. In
  descriptions, keep them to 25 words or fewer. [ste]
- One instruction per sentence: "Open the file. Read line 3." Don't chain
  steps with "and then". [ste]
- Keep every sentence part explicit. Don't drop the subject, verb, or article
  to save words: "Files that you don't back up are lost", not "Files not
  backed up are lost". [ste]
- Use a vertical list for three or more steps, conditions, or options. [ste]
- One idea per sentence and per paragraph. Split a paragraph that runs past
  about six sentences or that introduces a second idea. [paragraph-structure]
- Put the most important information first. [paragraph-structure]
- Prefer simpler words and shorter sentences: "use" rather than "utilize",
  "start" rather than "commence". [translation]
- Use "that is" and "for example", not "i.e." and "e.g.". [abbreviations]

## Words and phrases to avoid

- Vague or subjective modifiers, such as "simple", "easy", "easily",
  "quick", "careful", "thorough", and "proper". [inclusive-documentation]
- Superlatives and unverifiable claims: "best", "fastest", "simplest",
  "never", "always". Use "ensure" or "guarantee" only when literally true.
  [excessive-claims]
- Time-anchored words: "now", "new", "currently", "latest", "soon", "at
  present", "eventually", "existing". [timeless-documentation]
- Internet slang and abbreviations: "tl;dr", "ymmv", "RTFM".
  [tone, abbreviations]
- Phrasal verbs when one word works: write "use", not "make use of".
  [translation]
- More than two nouns stacked as modifiers of another noun. [translation]
- Qualifier stacks, such as "may potentially", "could possibly", and "it is
  worth noting that". State the claim or delete the sentence. Keep one
  qualifier when the uncertainty is real. [ste]
- Don't turn an action into a noun. Write "analyze the log", not "perform an
  analysis of the log". Write "helps", not "provides assistance to". [ste]

## Capitalization

- Sentence case for headings and titles, with no period at the end.
  [capitalization]
- Lowercase the first word after a colon, unless it's a proper noun, a
  heading, a quotation, or a Note/Caution label. [capitalization]
- Don't capitalize for emphasis, and don't rely on capitalization to convey
  meaning. [capitalization]

## Punctuation and formatting

- Use the serial (Oxford) comma. [highlights]
- Don't use semicolons. Write two sentences instead. [ste]
- Use an em dash with no spaces around it. For a term/description pair, use a
  colon or period, not a dash. [dashes]
- Use code font for code, filenames, paths, commands, class and method names,
  HTTP status codes, console output, and placeholders. [text-formatting]
- Use bold for UI elements and run-in headings. [text-formatting]
- Use descriptive link text, and put punctuation outside link text.
  [highlights]
- Don't use "&" as a substitute for "and". [text-formatting]
- Make list items parallel, and keep capitalization and punctuation
  consistent. [translation]

## Abbreviations and consistency

- Spell out a term on first use with the abbreviation in parentheses, then use
  the abbreviation. [abbreviations]
- Don't use an acronym as a verb: "Use SSH to log in", not "ssh into".
  [abbreviations]
- Use one term per concept, with the same capitalization, throughout. Keep
  one verb for one action: don't rotate "check", "verify", and "confirm" for
  the same check. [translation, ste]

## Numbers

- Use numerals and the percent sign, with no space: 40%, not 40 percent.
  [numbers]
- Spell out numbers zero through nine. Use numerals for 10 and greater.
  [numbers]

## Politeness

- Don't use "please" in instructions. [tone]

## Break the rules

- These are guidelines, not laws. Prioritize clarity and consistency for the
  reader. [philosophy]
