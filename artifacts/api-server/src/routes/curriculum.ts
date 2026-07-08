import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, lessonsTable, lessonCompletionsTable } from "@workspace/db";
import {
  GetCurriculumPathParams,
  ListLessonsQueryParams,
  CompleteLessonParams,
  CompleteLessonBody,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router = Router();

// Category labels per language
const CATEGORY_LABELS: Record<string, string> = {
  home_row: "Home Row Keys",
  top_row: "Top Row Keys",
  bottom_row: "Bottom Row Keys",
  numbers: "Numbers & Special Keys",
  symbols: "Symbols & Punctuation",
  words: "Common Words",
  sentences: "Sentences",
  paragraphs: "Paragraphs",
  swar: "Swar (Vowels)",
  vyanjan: "Vyanjan (Consonants)",
  matras: "Matras (Vowel Signs)",
  jodakshar: "Jodakshar (Conjuncts)",
  common_words: "Common Words",
};

const CATEGORY_ORDER: Record<string, string[]> = {
  english: ["home_row", "top_row", "bottom_row", "numbers", "symbols", "words", "sentences", "paragraphs"],
  marathi: ["swar", "vyanjan", "matras", "jodakshar", "common_words", "sentences", "paragraphs"],
  hindi: ["swar", "vyanjan", "matras", "common_words", "sentences", "paragraphs"],
};

function formatLessonItem(
  lesson: typeof lessonsTable.$inferSelect,
  completions: typeof lessonCompletionsTable.$inferSelect[],
  isLocked: boolean,
) {
  const lessonCompletions = completions.filter(c => c.lessonId === lesson.id);
  const bestCompletion = lessonCompletions.length > 0
    ? lessonCompletions.reduce((best, c) => c.accuracy > best.accuracy ? c : best)
    : null;

  return {
    id: lesson.id,
    language: lesson.language,
    category: lesson.category,
    title: lesson.title,
    description: lesson.description ?? null,
    content: lesson.content,
    targetKeys: lesson.targetKeys ?? null,
    orderIndex: lesson.orderIndex,
    minAccuracy: lesson.minAccuracy,
    minWpm: lesson.minWpm,
    isLocked,
    isCompleted: bestCompletion !== null && bestCompletion.accuracy >= lesson.minAccuracy,
    bestAccuracy: bestCompletion?.accuracy ?? null,
    bestWpm: bestCompletion?.wpm ?? null,
    completionCount: lessonCompletions.length,
  };
}

router.get("/curriculum/:language", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetCurriculumPathParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { language } = parsed.data;
  const userId = req.user!.userId;

  // Seed lessons if none exist yet
  await seedLessonsIfEmpty(language);

  const lessons = await db.select().from(lessonsTable)
    .where(and(eq(lessonsTable.language, language), eq(lessonsTable.isActive, true)))
    .orderBy(lessonsTable.orderIndex);

  const completions = await db.select().from(lessonCompletionsTable)
    .where(eq(lessonCompletionsTable.userId, userId));

  const categoryOrder = CATEGORY_ORDER[language] ?? [];
  const completedLessonsSet = new Set<number>();

  // Build categories with locked state
  const categories = categoryOrder.map((category, categoryIdx) => {
    const categoryLessons = lessons.filter(l => l.category === category);
    const prevCategoryDone = categoryIdx === 0 || categoryOrder.slice(0, categoryIdx).every(prevCat => {
      const prevLessons = lessons.filter(l => l.category === prevCat);
      return prevLessons.every(pl => {
        const plCompletions = completions.filter(c => c.lessonId === pl.id);
        return plCompletions.some(c => c.accuracy >= pl.minAccuracy);
      });
    });

    return {
      name: category,
      label: CATEGORY_LABELS[category] ?? category,
      lessons: categoryLessons.map((lesson, lessonIdx) => {
        // First lesson of first category is always unlocked
        let isLocked = false;
        if (categoryIdx > 0 && !prevCategoryDone) {
          isLocked = true;
        } else if (lessonIdx > 0) {
          // Previous lesson in same category must be completed
          const prevLesson = categoryLessons[lessonIdx - 1];
          const prevCompleted = completions.some(
            c => c.lessonId === prevLesson.id && c.accuracy >= prevLesson.minAccuracy
          );
          isLocked = !prevCompleted;
        }

        const item = formatLessonItem(lesson, completions, isLocked);
        if (item.isCompleted) completedLessonsSet.add(lesson.id);
        return item;
      }),
    };
  });

  res.json({
    language,
    categories,
    totalLessons: lessons.length,
    completedLessons: completedLessonsSet.size,
  });
});

router.get("/lessons", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListLessonsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { language } = parsed.data;
  const userId = req.user!.userId;

  if (language) await seedLessonsIfEmpty(language);

  const conditions = [];
  if (language) conditions.push(eq(lessonsTable.language, language));
  conditions.push(eq(lessonsTable.isActive, true));

  const lessons = await db.select().from(lessonsTable)
    .where(and(...conditions))
    .orderBy(lessonsTable.language, lessonsTable.orderIndex);

  const completions = await db.select().from(lessonCompletionsTable)
    .where(eq(lessonCompletionsTable.userId, userId));

  const items = lessons.map(lesson => formatLessonItem(lesson, completions, false));

  res.json({ lessons: items, total: items.length });
});

router.post("/lessons/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const parsedParams = CompleteLessonParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }

  const parsedBody = CompleteLessonBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  const { id: lessonId } = parsedParams.data;
  const { accuracy, wpm } = parsedBody.data;
  const userId = req.user!.userId;

  const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, lessonId));
  if (!lesson) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }

  const [completion] = await db.insert(lessonCompletionsTable).values({
    userId,
    lessonId,
    accuracy,
    wpm,
  }).returning();

  res.status(201).json({
    id: completion.id,
    lessonId: completion.lessonId,
    accuracy: completion.accuracy,
    wpm: completion.wpm,
    completedAt: completion.completedAt.toISOString(),
  });
});

// ─── Lesson Seeding ──────────────────────────────────────────────────────────

const _seeded = new Set<string>();

async function seedLessonsIfEmpty(language: string): Promise<void> {
  if (_seeded.has(language)) return;
  const existing = await db.select().from(lessonsTable)
    .where(eq(lessonsTable.language, language)).limit(1);
  if (existing.length > 0) {
    _seeded.add(language);
    return;
  }

  const seeds = getLessonSeeds(language);
  if (seeds.length > 0) {
    await db.insert(lessonsTable).values(seeds);
    _seeded.add(language);
  }
}

function getLessonSeeds(language: string) {
  if (language === "english") return englishLessons;
  if (language === "marathi") return marathiLessons;
  if (language === "hindi") return hindiLessons;
  return [];
}

const englishLessons = [
  // Home Row
  { language: "english", category: "home_row", title: "Home Row: ASDF", description: "Learn the left hand home row keys", content: "aaa sss ddd fff asd fds adf sad fda das sdf asdfasdf asdfasdf", targetKeys: "a s d f", orderIndex: 1, minAccuracy: 80, minWpm: 0 },
  { language: "english", category: "home_row", title: "Home Row: JKL;", description: "Learn the right hand home row keys", content: "jjj kkk lll ;;; jkl ;lk jlk klj ljk kj; jkl; jkl; jkl;", targetKeys: "j k l ;", orderIndex: 2, minAccuracy: 80, minWpm: 0 },
  { language: "english", category: "home_row", title: "Home Row: Both Hands", description: "Combine both hands on the home row", content: "as df jk l; asjk dfld jksa ljdf asdf jkl; asdf jkl; all fall glass", targetKeys: "a s d f j k l ;", orderIndex: 3, minAccuracy: 80, minWpm: 15 },
  // Top Row
  { language: "english", category: "top_row", title: "Top Row: QWER", description: "Left hand top row practice", content: "qqq www eee rrr qwe rqw erq wqe qwer qwer qwer were wee ewer", targetKeys: "q w e r", orderIndex: 4, minAccuracy: 80, minWpm: 0 },
  { language: "english", category: "top_row", title: "Top Row: UIOP", description: "Right hand top row practice", content: "uuu iii ooo ppp uio pou iou oui uiop uiop poor oil opium", targetKeys: "u i o p", orderIndex: 5, minAccuracy: 80, minWpm: 0 },
  { language: "english", category: "top_row", title: "Top Row: T & Y", description: "Center top row keys", content: "ttt yyy tyt yty try typo type they year tiny yet that your", targetKeys: "t y", orderIndex: 6, minAccuracy: 80, minWpm: 15 },
  // Bottom Row
  { language: "english", category: "bottom_row", title: "Bottom Row: ZXCV", description: "Left hand bottom row", content: "zzz xxx ccc vvv zxcv cvzx vxcz xzcv czxv cave vice zeal", targetKeys: "z x c v", orderIndex: 7, minAccuracy: 80, minWpm: 0 },
  { language: "english", category: "bottom_row", title: "Bottom Row: NM", description: "Right hand bottom row", content: "nnn mmm nm mn name moon mine man many men mean norm monk", targetKeys: "n m", orderIndex: 8, minAccuracy: 80, minWpm: 0 },
  // Numbers
  { language: "english", category: "numbers", title: "Numbers 1-5", description: "Practice numbers 1 through 5", content: "11 22 33 44 55 123 321 145 512 12345 54321 1234 4321 135 531", targetKeys: "1 2 3 4 5", orderIndex: 9, minAccuracy: 80, minWpm: 0 },
  { language: "english", category: "numbers", title: "Numbers 6-0", description: "Practice numbers 6 through 0", content: "66 77 88 99 00 678 890 670 980 67890 09876 6789 9870 680 890", targetKeys: "6 7 8 9 0", orderIndex: 10, minAccuracy: 80, minWpm: 0 },
  // Symbols
  { language: "english", category: "symbols", title: "Common Punctuation", description: "Practice period, comma, and apostrophe", content: "Hello, world. It's a fine day. Don't forget the comma, please. Yes, it works.", targetKeys: ". , '", orderIndex: 11, minAccuracy: 80, minWpm: 0 },
  { language: "english", category: "symbols", title: "More Symbols", description: "Practice question marks, exclamations, and more", content: "What? Really! How are you? I'm fine! Can you type faster? Yes, I can! Let's go!", targetKeys: "? ! @ # $", orderIndex: 12, minAccuracy: 80, minWpm: 0 },
  // Words
  { language: "english", category: "words", title: "Common Short Words", description: "100 most common words", content: "the and for are but not you all can had her was one our out day get has him his how its may new now old see two way who did", targetKeys: "", orderIndex: 13, minAccuracy: 85, minWpm: 20 },
  { language: "english", category: "words", title: "Action Words", description: "Common verbs", content: "run jump walk talk listen speak write read eat drink sleep wake work play learn teach help give take make", targetKeys: "", orderIndex: 14, minAccuracy: 85, minWpm: 20 },
  // Sentences
  { language: "english", category: "sentences", title: "Simple Sentences", description: "Short sentences for fluency", content: "The quick brown fox jumps. She sells sea shells. How much wood would a woodchuck chuck. Peter Piper picked peppers.", targetKeys: "", orderIndex: 15, minAccuracy: 85, minWpm: 25 },
  { language: "english", category: "sentences", title: "Complex Sentences", description: "Longer sentences for speed", content: "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. Sphinx of black quartz judge my vow.", targetKeys: "", orderIndex: 16, minAccuracy: 85, minWpm: 30 },
  // Paragraphs
  { language: "english", category: "paragraphs", title: "Short Paragraph", description: "A full short paragraph", content: "Typing is a valuable skill in the modern digital age. Regular practice improves both speed and accuracy. Begin with proper finger placement on the home row keys and gradually increase your speed over time.", targetKeys: "", orderIndex: 17, minAccuracy: 85, minWpm: 30 },
  { language: "english", category: "paragraphs", title: "Medium Paragraph", description: "Professional-length paragraph", content: "The importance of touch typing cannot be overstated in today's world. As computers have become central to nearly every profession, the ability to type quickly and accurately translates directly into increased productivity. Those who master this skill find themselves completing tasks faster and with fewer errors than their peers.", targetKeys: "", orderIndex: 18, minAccuracy: 85, minWpm: 35 },
];

const marathiLessons = [
  { language: "marathi", category: "swar", title: "स्वर: अ आ", description: "पहिले स्वर शिका", content: "अ आ अ आ अआ आअ अआअ आअआ अ आ इ ई उ ऊ", targetKeys: "a aa", orderIndex: 1, minAccuracy: 80, minWpm: 0 },
  { language: "marathi", category: "swar", title: "स्वर: इ ई उ ऊ", description: "लघु आणि दीर्घ स्वर", content: "इ ई उ ऊ इई ईइ उऊ ऊउ इउ ईऊ अइउ आईऊ", targetKeys: "i ii u uu", orderIndex: 2, minAccuracy: 80, minWpm: 0 },
  { language: "marathi", category: "swar", title: "स्वर: ए ऐ ओ औ", description: "संयुक्त स्वर शिका", content: "ए ऐ ओ औ एऐ ओऔ एओ ऐऔ अएओ आऐऔ", targetKeys: "e ai o au", orderIndex: 3, minAccuracy: 80, minWpm: 0 },
  { language: "marathi", category: "vyanjan", title: "व्यंजन: क ख ग", description: "क वर्गातील व्यंजन", content: "क का कि की कु कू के कै को कौ ख खा ग गा", targetKeys: "k kh g", orderIndex: 4, minAccuracy: 80, minWpm: 0 },
  { language: "marathi", category: "vyanjan", title: "व्यंजन: च छ ज", description: "च वर्गातील व्यंजन", content: "च चा चि ची चु चू छ छा ज जा जि जी जु जू", targetKeys: "ch chh j", orderIndex: 5, minAccuracy: 80, minWpm: 0 },
  { language: "marathi", category: "vyanjan", title: "व्यंजन: त थ द ध", description: "त वर्गातील व्यंजन", content: "त ता ति ती तु तू थ था द दा दि दी ध धा", targetKeys: "t th d dh", orderIndex: 6, minAccuracy: 80, minWpm: 0 },
  { language: "marathi", category: "vyanjan", title: "व्यंजन: प फ ब", description: "प वर्गातील व्यंजन", content: "प पा पि पी फ फा ब बा बि बी भ भा म मा", targetKeys: "p ph b", orderIndex: 7, minAccuracy: 80, minWpm: 0 },
  { language: "marathi", category: "matras", title: "आकार मात्रा", description: "आकार मात्रेचा सराव", content: "का खा गा चा जा दा पा बा मा रा ला सा हा", targetKeys: "aa matra", orderIndex: 8, minAccuracy: 80, minWpm: 0 },
  { language: "marathi", category: "matras", title: "इकार उकार मात्रा", description: "ि ी ु ू मात्रा", content: "कि की कु कू गि गी गु गू जि जी जु जू पि पी", targetKeys: "i-matra u-matra", orderIndex: 9, minAccuracy: 80, minWpm: 0 },
  { language: "marathi", category: "matras", title: "एकार मात्रा", description: "े ै ो ौ मात्रा", content: "के खे गे चे जे दे पे मे रे ले सो हो जो तो", targetKeys: "e-matra o-matra", orderIndex: 10, minAccuracy: 80, minWpm: 0 },
  { language: "marathi", category: "jodakshar", title: "सोपे जोडाक्षर", description: "साध्या जोडाक्षरांचा सराव", content: "क्र त्र ज्ञ श्र क्ष प्र न्य स्त ग्र द्र", targetKeys: "conjuncts", orderIndex: 11, minAccuracy: 80, minWpm: 0 },
  { language: "marathi", category: "common_words", title: "सामान्य शब्द", description: "रोजच्या वापरातील शब्द", content: "मी तू तो ती ते आपण हे ते काय कसे कोण कधी कुठे", targetKeys: "", orderIndex: 12, minAccuracy: 85, minWpm: 15 },
  { language: "marathi", category: "sentences", title: "साध्या वाक्ये", description: "लहान वाक्यांचा सराव", content: "मी मराठी शिकतो. तू कसा आहेस? आम्ही खूप आनंदात आहोत. हे फळ चांगले आहे.", targetKeys: "", orderIndex: 13, minAccuracy: 85, minWpm: 20 },
  { language: "marathi", category: "paragraphs", title: "लहान उतारा", description: "मराठी परिच्छेद लेखन", content: "मराठी ही महाराष्ट्राची अधिकृत भाषा आहे. ही भाषा सुमारे सात कोटी लोक बोलतात. मराठी साहित्याची एक समृद्ध परंपरा आहे.", targetKeys: "", orderIndex: 14, minAccuracy: 85, minWpm: 25 },
];

const hindiLessons = [
  { language: "hindi", category: "swar", title: "स्वर: अ आ इ ई", description: "हिंदी के पहले स्वर", content: "अ आ इ ई अआ इई अइ आई अआइई", targetKeys: "a aa i ii", orderIndex: 1, minAccuracy: 80, minWpm: 0 },
  { language: "hindi", category: "swar", title: "स्वर: उ ऊ ए ऐ ओ औ", description: "शेष स्वरों का अभ्यास", content: "उ ऊ ए ऐ ओ औ उऊ एऐ ओऔ उएओ ऊऐऔ", targetKeys: "u uu e ai o au", orderIndex: 2, minAccuracy: 80, minWpm: 0 },
  { language: "hindi", category: "vyanjan", title: "व्यंजन: क ख ग घ", description: "क वर्ग के व्यंजन", content: "क का कि की कु कू के कै को कौ ख खा ग गा घ घा", targetKeys: "k kh g gh", orderIndex: 3, minAccuracy: 80, minWpm: 0 },
  { language: "hindi", category: "vyanjan", title: "व्यंजन: च छ ज झ", description: "च वर्ग के व्यंजन", content: "च चा छ छा ज जा जि जी झ झा झि झी", targetKeys: "ch chh j jh", orderIndex: 4, minAccuracy: 80, minWpm: 0 },
  { language: "hindi", category: "vyanjan", title: "व्यंजन: त थ द ध न", description: "त वर्ग के व्यंजन", content: "त ता थ था द दा ध धा न ना तु थु दि नि", targetKeys: "t th d dh n", orderIndex: 5, minAccuracy: 80, minWpm: 0 },
  { language: "hindi", category: "vyanjan", title: "व्यंजन: प फ ब भ म", description: "प वर्ग के व्यंजन", content: "प पा फ फा ब बा भ भा म मा पि फि बि मि", targetKeys: "p ph b bh m", orderIndex: 6, minAccuracy: 80, minWpm: 0 },
  { language: "hindi", category: "matras", title: "आ की मात्रा", description: "आकार मात्रा का अभ्यास", content: "का खा गा चा जा दा पा बा मा रा ला सा हा", targetKeys: "aa matra", orderIndex: 7, minAccuracy: 80, minWpm: 0 },
  { language: "hindi", category: "matras", title: "इ ई उ ऊ की मात्राएँ", description: "लघु और दीर्घ स्वर मात्राएँ", content: "कि की कु कू गि गी गु गू जि जी जु जू पि पी", targetKeys: "i-matra u-matra", orderIndex: 8, minAccuracy: 80, minWpm: 0 },
  { language: "hindi", category: "matras", title: "ए ओ की मात्राएँ", description: "े ो ै ौ मात्राएँ", content: "के खे गे चे जे दे पे सो हो जो तो मो को", targetKeys: "e-matra o-matra", orderIndex: 9, minAccuracy: 80, minWpm: 0 },
  { language: "hindi", category: "common_words", title: "सामान्य शब्द", description: "रोज़ाना उपयोग होने वाले शब्द", content: "मैं तुम वह यह हम आप क्या कैसे कौन कब कहाँ", targetKeys: "", orderIndex: 10, minAccuracy: 85, minWpm: 15 },
  { language: "hindi", category: "sentences", title: "सरल वाक्य", description: "छोटे वाक्यों का अभ्यास", content: "मैं हिंदी सीख रहा हूँ। तुम कैसे हो? हम सब खुश हैं। यह फल मीठा है।", targetKeys: "", orderIndex: 11, minAccuracy: 85, minWpm: 20 },
  { language: "hindi", category: "paragraphs", title: "छोटा अनुच्छेद", description: "हिंदी अनुच्छेद लेखन", content: "हिंदी भारत की राजभाषा है। यह देवनागरी लिपि में लिखी जाती है। लगभग पचास करोड़ लोग हिंदी बोलते हैं। यह एक सुंदर और समृद्ध भाषा है।", targetKeys: "", orderIndex: 12, minAccuracy: 85, minWpm: 25 },
];

export default router;
