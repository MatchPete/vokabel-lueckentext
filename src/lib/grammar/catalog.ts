// Grammatikkapitel G1–G37 von Green Line 1 Bayern.
// Zuordnung zu den Units aus der Übersicht "Grammatical terms" und dem Inhaltsverzeichnis des Buchs.
// Regeln und Beispiele sind eigene Kurzfassungen, keine Abschriften aus dem Buch.

export type CheckKind =
  | "plural" | "be" | "be_neg" | "short_be" | "wh" | "possessive" | "there"
  | "article" | "have_got" | "short_have" | "modal" | "imperative" | "genitive" | "demonstrative"
  | "third_person" | "word_order" | "frequency" | "do_q" | "short_do" | "do_neg" | "object_pronoun"
  | "quantity" | "progressive" | "past" | "short_did" | "past_neg" | "conjunction" | "free";

export type Chapter = {
  code: string; // "G1"
  unit: string; // textbook_units.code, z. B. "U1"
  title: string; // deutsch
  titleEn: string;
  page?: number; // Seite im Buch (nur wo belegt)
  rule: string[]; // kurze Regel in eigenen Worten
  examples: string[]; // eigene Beispiele
  check: CheckKind;
  task: string; // Anweisung an Claude: wie die Aufgaben aussehen
};

export const GREEN_LINE_BAYERN = "Green Line 1 Bayern";

export const CHAPTERS: Chapter[] = [
  // ---------------- Unit 1
  {
    code: "G1", unit: "U1", title: "Nomen im Singular und Plural", titleEn: "Nouns in the singular and plural", page: 160, check: "plural",
    rule: [
      "Den Plural bildest du fast immer mit -s: a dog – two dogs, a house – two houses.",
      "Ausnahme in der Schreibung: Konsonant + y wird zu -ies: a family – two families, a hobby – two hobbies.",
      "Unregelmäßig ist z. B. a mouse – two mice.",
      "Aussprache: nach harten Lauten [s] (parks), nach weichen Lauten [z] (beds), nach Zischlauten [ɪz] (houses, fridges).",
    ],
    examples: ["one cat – three cats", "a family – two families", "a house – five houses"],
    task: "Each item: a short sentence with a number or 'two/three' and a gap for a plural noun. The cue is the singular noun in brackets, e.g. sentence 'There are three ___ in the garden.' cue '(tree)' answers ['trees']. Use ONLY nouns whose plural is: + s, or consonant + y → ies, or 'mouse → mice'. Do NOT use nouns that need -es (box, bus, watch, dish …) or end in -o, -f, -fe. Include two or three -ies plurals and at most one 'mice'.",
  },
  {
    code: "G2", unit: "U1", title: "Personalpronomen und die Formen von be", titleEn: "Personal pronouns and the forms of be", page: 161, check: "be",
    rule: [
      "I → am, you/we/they → are, he/she/it → is.",
      "Meist benutzt man Kurzformen: I'm, you're, he's, she's, it's, we're, they're.",
      "Tiere, die man beim Namen kennt, sind he oder she, sonst it.",
    ],
    examples: ["I am eleven. – I'm eleven.", "They are my friends. – They're my friends."],
    task: "Mix two kinds of items. (a) Most items: a gap for the correct form of 'be' (am / is / are) after a personal pronoun or a name. Cue '(be)'. Answers: only the long form, e.g. 'We ___ from Greenwich.' cue '(be)' answers ['are']. (b) Two or three items: a gap for the personal pronoun that replaces a person, animal or thing named in the first part, e.g. 'This is Tom. ___ is my brother.' cue '' answers ['He']; a pet with a name is he/she, a thing is it.",
  },
  {
    code: "G3", unit: "U1", title: "Die Verneinung von be", titleEn: "The negative forms of be", page: 162, check: "be_neg",
    rule: [
      "Verneinung mit not: I am not, you are not, he is not …",
      "Kurzformen: isn't, aren't. Bei am geht das nicht: I'm not.",
    ],
    examples: ["He isn't quiet.", "We aren't from London.", "I'm not ten."],
    task: "Each item: a negative sentence with a gap for the negative form of 'be'. Cue '(not)'. Answers: short form AND long form, e.g. 'She ___ in the kitchen.' cue '(not)' answers ['isn\\'t', 'is not']. For 'I' the gap is after 'I\\'m' or use answers ['am not'] with sentence 'I ___ twelve.'",
  },
  {
    code: "G4", unit: "U1", title: "Ja/Nein-Fragen und Kurzantworten mit be", titleEn: "Yes/No questions and short answers with be", page: 163, check: "short_be",
    rule: [
      "Bei Fragen tauschen Subjekt und be die Plätze: Luke is … → Is Luke …?",
      "Kurzantwort mit yes: Langform (Yes, I am. / Yes, she is.).",
      "Kurzantwort mit no: Kurzform (No, I'm not. / No, she isn't.).",
    ],
    examples: ["Are you eleven? – Yes, I am.", "Is it in the bedroom? – No, it isn't."],
    task: "Each item: a yes/no question with 'be' followed by ' – ___'. The child writes the complete short answer. Cue '(yes)' or '(no)'. Answers: the correct short answer, e.g. 'Is she your sister? – ___' cue '(no)' answers ['No, she isn\\'t.']. With yes ALWAYS the long form ('Yes, I am.'), with no ALWAYS the short form ('No, I\\'m not.', 'No, he isn\\'t.', 'No, they aren\\'t.'). Mix yes and no.",
  },
  {
    code: "G5", unit: "U1", title: "Fragen mit Fragewörtern", titleEn: "Questions with question words", page: 164, check: "wh",
    rule: [
      "where = wo, who = wer, what = was, how old = wie alt.",
      "Nach dem Fragewort wird is oft verkürzt: Where's …? Who's …? What's …?",
      "Achtung: where heißt nicht „wer“, who heißt nicht „wo“.",
    ],
    examples: ["Where is Sherlock? – He's in the garden.", "How old are you? – I'm eleven."],
    task: "Each item: a question with a gap for the question word, followed by its answer, e.g. '___ is your sister? – She\\'s in her room.' cue '' answers ['Where']. Use where, who, what, how old (and 'where … from'). The answer part makes the question word clear.",
  },
  {
    code: "G6", unit: "U1", title: "Die Possessivbegleiter", titleEn: "Possessive determiners", page: 165, check: "possessive",
    rule: [
      "my, your, his, her, its, our, your, their – sie zeigen, wem etwas gehört.",
      "Jeder Begleiter hat nur eine Form: my sister, my brother, my parents.",
      "Verwechsle nicht your mit you're und its mit it's.",
    ],
    examples: ["Lucy is in her room.", "The dog is in its basket.", "Tom and Ben – their house is big."],
    task: "Mix two kinds of items. (a) About six items: a gap for a possessive determiner; the context (a name or pronoun earlier in the sentence) makes the owner clear, e.g. 'Lucy likes ___ bedroom.' cue '' answers ['her']. Use my, your, his, her, its, our, their over the set. (b) Two items where the child must choose between the look-alikes, with the cue showing both, e.g. '___ a nice dog.' cue '(your / you\'re)' answers ['You\'re']; 'The house is old. ___ door is green.' cue '(its / it\'s)' answers ['Its'].",
  },
  {
    code: "G7", unit: "U1", title: "Aussagen, Fragen und Kurzantworten mit there is / there are", titleEn: "Statements, questions and short answers with there is / there are", check: "there",
    rule: [
      "there is (Singular) / there are (Plural) = es gibt, da ist / da sind.",
      "Frage: Is there …? / Are there …?",
      "Kurzantwort: Yes, there is. / No, there isn't. – Yes, there are. / No, there aren't.",
    ],
    examples: ["There's a cat under the bed.", "Are there two chairs? – Yes, there are."],
    task: "Mix two kinds of items. (a) Statements or questions with a gap for 'is', 'are', 'Is', 'Are' next to 'there', e.g. 'There ___ two beds in my room.' answers ['are']. (b) Questions followed by ' – ___' where the child writes the short answer, cue '(yes)' or '(no)', e.g. 'Is there a TV in the kitchen? – ___' cue '(no)' answers ['No, there isn\\'t.']. With yes the long form ('Yes, there is.'), with no the short form.",
  },
  // ---------------- Unit 2
  { code: "G8", unit: "U2", title: "Der unbestimmte Artikel a / an", titleEn: "The indefinite article", check: "article",
    rule: ["a vor Konsonantenlaut: a pen, a red bag.", "an vor Vokallaut: an apple, an orange pen.", "Es kommt auf den Laut an: an hour, aber a uniform."],
    examples: ["I've got a blue pen and an orange pen."],
    task: "Each item: a sentence with a gap for 'a' or 'an' before a noun or adjective + noun. Answers ['a'] or ['an'] depending on the sound of the next word." },
  { code: "G9", unit: "U2", title: "Der bestimmte Artikel the", titleEn: "The definite article", check: "article",
    rule: ["the = der, die, das – für alle Wörter gleich.", "Vor Vokallaut spricht man es [ði], sonst [ðə]."],
    examples: ["The dog is in the garden.", "Where's the orange bag?"],
    task: "Each item: a sentence with a gap where the child must decide between 'a', 'an' and 'the' (the = a specific thing already known). Answers one of these." },
  { code: "G10", unit: "U2", title: "have got / has got", titleEn: "have got – long and short forms", check: "have_got",
    rule: ["I/you/we/they have got, he/she/it has got = haben, besitzen.", "Kurzformen: I've got, she's got."],
    examples: ["We've got a dog.", "Lucy has got a new bike."],
    task: "Each item: a sentence with a gap for 'have got' or 'has got' directly after the subject. Cue '(have got)'. Answers ['has got'] or ['have got']." },
  { code: "G11", unit: "U2", title: "Die Verneinung von have got", titleEn: "Negative forms of have got", check: "have_got",
    rule: ["Verneinung: haven't got / hasn't got.", "Langform: have not got / has not got."],
    examples: ["I haven't got a pet.", "Tom hasn't got a phone."],
    task: "Each item: a negative sentence with a gap for haven't got / hasn't got. Cue '(not / have got)'. Answers short and long form, e.g. ['hasn\\'t got', 'has not got']." },
  { code: "G12", unit: "U2", title: "Fragen und Kurzantworten mit have got", titleEn: "Questions and short answers with have got", check: "short_have",
    rule: ["Frage: Have you got …? Has she got …?", "Kurzantwort: Yes, I have. / No, I haven't. – Yes, she has. / No, she hasn't."],
    examples: ["Have you got a uniform? – Yes, I have."],
    task: "Each item: a question with have/has got followed by ' – ___'; the child writes the short answer. Cue '(yes)' or '(no)'. Answers e.g. ['No, he hasn\\'t.']. Never 'got' in the short answer." },
  { code: "G13", unit: "U2", title: "Fragen mit who / what und whose", titleEn: "Questions with who, what and whose", check: "wh",
    rule: ["who = wer/wen, what = was, whose = wessen.", "Fragt who/what nach dem Subjekt, bleibt die Satzstellung wie im Aussagesatz: Who has got a pen?"],
    examples: ["Who is your teacher?", "Whose bag is this? – It's Tom's."],
    task: "Each item: a question with a gap for who, what or whose, followed by the answer that makes it clear. Answers e.g. ['Whose']." },
  { code: "G14", unit: "U2", title: "can / can't", titleEn: "can and can't", check: "modal",
    rule: ["can = kann/darf, can't = kann nicht/darf nicht.", "can hat für alle Personen dieselbe Form, danach Grundform: She can swim."],
    examples: ["I can play the guitar.", "You can't eat in class."],
    task: "Each item: a sentence with a gap for 'can' or 'can't'; context shows which. Answers ['can'] or ['can\\'t', 'cannot']." },
  { code: "G15", unit: "U2", title: "Der Imperativ", titleEn: "The imperative", check: "imperative",
    rule: ["Befehl oder Bitte mit der Grundform: Open the door!", "Verneint mit Don't: Don't run!", "Höflicher mit please."],
    examples: ["Be quiet, please.", "Don't stare! It's rude."],
    task: "Each item: a short situation with a gap for an imperative; cue the verb in brackets and whether negative, e.g. '___ your phone to school!' cue '(not / bring)' answers ['Don\\'t bring', 'Do not bring']." },
  { code: "G16", unit: "U2", title: "Der s-Genitiv", titleEn: "The s-genitive", check: "genitive",
    rule: ["Besitz bei Personen und Tieren: Luke's dog, my sister's room.", "Plural auf -s: nur Apostroph: my parents' car.", "Unregelmäßiger Plural: the children's room."],
    examples: ["This is Lucy's bag.", "The girls' bikes are new."],
    task: "Each item: a sentence with a gap for a possessive with 's or s'. Cue the owner in brackets, e.g. 'This is ___ bike.' cue '(Tom)' answers ['Tom\\'s']." },
  { code: "G17", unit: "U2", title: "Die Besitzform mit of", titleEn: "The possessive form with of", check: "free",
    rule: ["Bei Dingen und Orten: the door of the house, the end of the street."],
    examples: ["I live at the end of the street."],
    task: "Each item: a sentence with a gap for 'of the' or a phrase with of, e.g. 'The windows ___ school are big.' cue '' answers ['of the']." },
  { code: "G18", unit: "U2", title: "this / that, these / those", titleEn: "Demonstrative pronouns", check: "demonstrative",
    rule: ["this (Singular) / these (Plural) = hier, nah.", "that (Singular) / those (Plural) = dort, weiter weg."],
    examples: ["This is my pen. Those pens are red."],
    task: "Each item: a sentence with a gap for this, that, these or those; context (here/there, singular/plural) makes it clear. Answers one word." },
  // ---------------- Unit 3
  { code: "G19", unit: "U3", title: "Das simple present", titleEn: "The simple present", check: "third_person",
    rule: ["Für Gewohnheiten und Regelmäßiges: I play football on Mondays.", "Bei he/she/it kommt -s dazu: she plays, he goes, it watches.", "Konsonant + y → -ies: he tries."],
    examples: ["Olivia plays netball on Tuesdays.", "My dad watches TV in the evening."],
    task: "Each item: a sentence about a habit with a gap for the simple present verb, cue the infinitive, e.g. 'Tom ___ to school by bus.' cue '(go)' answers ['goes']. Mostly he/she/it, sometimes I/we/they." },
  { code: "G20", unit: "U3", title: "Die Satzstellung", titleEn: "Word order", check: "word_order",
    rule: ["Subjekt – Verb – Objekt: Dave plays computer games.", "Ort vor Zeit: I do my homework in my room in the evening."],
    examples: ["We eat pizza on Fridays."],
    task: "Each item: a sentence with a gap of two or three words where the child puts given words in the right order; cue the words in brackets in mixed order, e.g. 'I ___ .' cue '(my homework / do)' answers ['do my homework']." },
  { code: "G21", unit: "U3", title: "Häufigkeitsadverbien", titleEn: "Adverbs of frequency", check: "frequency",
    rule: ["always, usually, often, sometimes, never.", "Sie stehen vor dem Vollverb (I never write), aber nach be (She is always late)."],
    examples: ["I often play tennis.", "He is never quiet."],
    task: "Each item: a sentence with a gap of two words: the frequency adverb plus the verb or be in the right order; cue e.g. '(always / is)' answers ['is always']." },
  // ---------------- Unit 4
  { code: "G22", unit: "U4", title: "Fragen und Kurzantworten mit do / does", titleEn: "Questions and short answers with do/does", check: "short_do",
    rule: ["Fragen im simple present mit Do/Does: Do you like …? Does she play …?", "Nach does steht die Grundform ohne -s.", "Kurzantwort: Yes, I do. / No, she doesn't."],
    examples: ["Do you know the museum? – Yes, I do."],
    task: "Mix: (a) gap for Do/Does at the start of a question, answers ['Do'] or ['Does']; (b) question followed by ' – ___' with cue '(yes)' or '(no)', the child writes the short answer e.g. ['No, she doesn\\'t.']." },
  { code: "G23", unit: "U4", title: "Verneinung mit don't / doesn't", titleEn: "Negative statements with don't/doesn't", check: "do_neg",
    rule: ["I/you/we/they don't, he/she/it doesn't + Grundform.", "Nach doesn't kein -s: She doesn't like fish."],
    examples: ["We don't get up early on Sundays."],
    task: "Each item: a negative sentence with a gap for don't/doesn't + verb; cue the verb, e.g. 'Ben ___ football.' cue '(not / like)' answers ['doesn\\'t like', 'does not like']." },
  { code: "G24", unit: "U4", title: "Objektformen der Personalpronomen", titleEn: "Object pronouns", check: "object_pronoun",
    rule: ["me, you, him, her, it, us, you, them – nach Verben und Präpositionen.", "I like him. Come with us!"],
    examples: ["Where's Lucy? I can't see her.", "These are my shoes. I love them."],
    task: "Each item: a sentence with a gap for an object pronoun; cue the subject pronoun in brackets, e.g. 'Grandma visits ___ every Sunday.' cue '(we)' answers ['us']." },
  { code: "G25", unit: "U4", title: "Fragen mit Fragewort und do / does", titleEn: "Wh-questions with do/does", check: "do_q",
    rule: ["Fragewort + do/does + Subjekt + Grundform: When does the farm open?"],
    examples: ["What do you do after school?", "Where does Tom live?"],
    task: "Each item: a wh-question with a gap for 'do' or 'does' after the question word, followed by the answer. Answers ['do'] or ['does']." },
  // ---------------- Unit 5
  { code: "G26", unit: "U5", title: "Mengenangaben mit of", titleEn: "Expressions of quantity with of", check: "free",
    rule: ["a bottle of water, a packet of biscuits, a glass of milk, a piece of cake."],
    examples: ["Can I have a bottle of water, please?"],
    task: "Each item: a shopping sentence with a gap for a container word + of, e.g. 'Can I have a ___ milk, please?' cue '(Flasche)' answers ['bottle of']." },
  { code: "G27", unit: "U5", title: "Das present progressive", titleEn: "The present progressive", check: "progressive",
    rule: ["Was gerade jetzt passiert: am/is/are + -ing: They are sitting outside.", "Simple present = regelmäßig, present progressive = gerade jetzt.", "Schreibung: make → making, sit → sitting."],
    examples: ["Look! Tom is running.", "I'm reading a book now."],
    task: "Each item: a sentence with a signal word (now, look!, at the moment) and a gap for am/is/are + -ing form; cue the infinitive, e.g. 'Look! The cat ___ on the table.' cue '(sleep)' answers ['is sleeping', '\\'s sleeping']." },
  { code: "G28", unit: "U5", title: "some / any / no", titleEn: "some, any, no", check: "quantity",
    rule: ["some in Aussagesätzen und höflichen Angeboten, any in Fragen und verneinten Sätzen.", "no = kein: There's no milk."],
    examples: ["We've got some apples.", "Have you got any money?"],
    task: "Each item: a sentence with a gap for some, any or no. Answers one word." },
  { code: "G29", unit: "U5", title: "Zusammensetzungen mit some, any, every, no", titleEn: "Compounds with some, any, every, no", check: "quantity",
    rule: ["something, anything, everything, nothing; somebody/someone, anybody, everybody, nobody; somewhere, anywhere, everywhere, nowhere."],
    examples: ["There's something here for everyone."],
    task: "Each item: a sentence with a gap for a compound with some/any/every/no. Answers one word (list both -body and -one forms where both fit)." },
  { code: "G30", unit: "U5", title: "much / many / a lot of", titleEn: "much, many, a lot of", check: "quantity",
    rule: ["many vor zählbaren Nomen im Plural, much vor nicht zählbaren.", "a lot of / lots of passt zu beiden, vor allem in Aussagesätzen."],
    examples: ["How many pens have you got?", "We haven't got much time."],
    task: "Each item: a sentence with a gap for much, many or a lot of. Answers accordingly (list 'lots of' too where 'a lot of' is correct)." },
  { code: "G31", unit: "U5", title: "a few / a little / a couple of", titleEn: "a few, a little, a couple of", check: "quantity",
    rule: ["a few = ein paar (zählbar), a little = ein bisschen (nicht zählbar), a couple of = ein paar / zwei."],
    examples: ["I've got a few friends here.", "Can I have a little milk?"],
    task: "Each item: a sentence with a gap for a few, a little or a couple of. Answers accordingly." },
  // ---------------- Unit 6
  { code: "G32", unit: "U6", title: "can / can't / mustn't", titleEn: "can, can't, mustn't", check: "modal",
    rule: ["can = darf, can't = darf nicht, mustn't = darf auf keinen Fall."],
    examples: ["You mustn't run in the corridor."],
    task: "Each item: a rule or permission sentence with a gap for can, can't or mustn't. Answers one form (list 'must not' for mustn't)." },
  { code: "G33", unit: "U6", title: "must / needn't", titleEn: "must, needn't", check: "modal",
    rule: ["must = muss, needn't = muss nicht, braucht nicht.", "Achtung: mustn't heißt „darf nicht“, nicht „muss nicht“!"],
    examples: ["You needn't bring a present.", "I must tidy my room."],
    task: "Each item: a sentence with a gap for must, needn't or mustn't; context makes it clear. Answers one form." },
  { code: "G34", unit: "U6", title: "Das simple past", titleEn: "The simple past", check: "past",
    rule: ["Für Vergangenes: regelmäßig mit -ed (played, wanted).", "Viele Verben sind unregelmäßig: go – went, have – had, see – saw.", "Signalwörter: yesterday, last week, ago."],
    examples: ["We played games yesterday.", "Lucy went to a party last Saturday."],
    task: "Each item: a sentence with a past time signal and a gap for the simple past verb; cue the infinitive, e.g. 'Yesterday we ___ pizza.' cue '(eat)' answers ['ate']. Mix regular and irregular verbs." },
  { code: "G35", unit: "U6", title: "Fragen und Kurzantworten im simple past", titleEn: "Questions and short answers in the simple past", check: "short_did",
    rule: ["Fragen mit Did + Grundform: Did you like the party?", "Kurzantwort: Yes, I did. / No, I didn't."],
    examples: ["Did Tom come? – No, he didn't."],
    task: "Mix: (a) a question with a gap for 'Did' + infinitive, cue the verb, e.g. '___ the party?' cue '(you / like)' answers ['Did you like']; (b) question + ' – ___' with cue '(yes)'/'(no)' answers e.g. ['Yes, she did.']." },
  { code: "G36", unit: "U6", title: "Verneinung im simple past", titleEn: "Negative statements in the simple past", check: "past_neg",
    rule: ["didn't + Grundform für alle Personen: I didn't go, she didn't go."],
    examples: ["I didn't decorate the yard."],
    task: "Each item: a negative past sentence with a gap for didn't + infinitive; cue '(not / verb)'. Answers ['didn\\'t go', 'did not go'] etc." },
  { code: "G37", unit: "U6", title: "Haupt- und Nebensätze", titleEn: "Main clauses and subordinate clauses", check: "conjunction",
    rule: ["Ein Nebensatz hängt an einem Hauptsatz und beginnt z. B. mit because, when oder if.", "Im Englischen bleibt die Wortstellung im Nebensatz wie im Hauptsatz: … because she is nice."],
    examples: ["I like my friend because she is nice."],
    task: "Each item: two ideas joined by a gap for the right conjunction (because, when, if, but, and, so). Answers one word." },
];

export const CHAPTER_BY_CODE = new Map(CHAPTERS.map((c) => [c.code, c]));
export const UNIT_ORDER = ["U1", "U2", "U3", "U4", "U5", "U6"];
export const unitLabel = (u: string) => `Unit ${u.slice(1)}`;
