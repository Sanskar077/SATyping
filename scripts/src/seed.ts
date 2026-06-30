import { db, usersTable, institutesTable, batchesTable, passagesTable, subscriptionsTable } from "@workspace/db";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  // Create super admin
  const [superAdmin] = await db.insert(usersTable).values({
    email: "admin@gcctbc.com",
    passwordHash: await bcrypt.hash("Admin@1234", 10),
    name: "Super Admin",
    role: "super_admin",
    subscriptionPlan: "institute",
    isActive: true,
  }).onConflictDoNothing().returning();

  if (superAdmin) {
    await db.insert(subscriptionsTable).values({
      userId: superAdmin.id,
      plan: "institute",
      status: "active",
      startedAt: new Date(),
    }).onConflictDoNothing();
    console.log("Created super admin: admin@gcctbc.com / Admin@1234");
  }

  // Create a demo institute
  const [institute] = await db.insert(institutesTable).values({
    name: "GCC Typing Academy",
    address: "Mumbai, Maharashtra",
    phone: "+91-9876543210",
    email: "info@gcctyping.com",
    subscriptionPlan: "institute",
  }).onConflictDoNothing().returning();

  let instituteId = institute?.id;

  if (!institute) {
    const [existing] = await db.select().from(institutesTable);
    instituteId = existing?.id;
  } else {
    console.log("Created institute: GCC Typing Academy");
  }

  // Create a teacher
  const [teacher] = await db.insert(usersTable).values({
    email: "teacher@gcctbc.com",
    passwordHash: await bcrypt.hash("Teacher@1234", 10),
    name: "Ramesh Kumar",
    role: "teacher",
    subscriptionPlan: "pro_student",
    isActive: true,
    instituteId: instituteId ?? null,
  }).onConflictDoNothing().returning();

  if (teacher) {
    await db.insert(subscriptionsTable).values({
      userId: teacher.id,
      plan: "pro_student",
      status: "active",
    }).onConflictDoNothing();
    console.log("Created teacher: teacher@gcctbc.com / Teacher@1234");
  }

  // Create a student
  const [student] = await db.insert(usersTable).values({
    email: "student@gcctbc.com",
    passwordHash: await bcrypt.hash("Student@1234", 10),
    name: "Priya Sharma",
    role: "student",
    subscriptionPlan: "pro_student",
    isActive: true,
    instituteId: instituteId ?? null,
  }).onConflictDoNothing().returning();

  if (student) {
    await db.insert(subscriptionsTable).values({
      userId: student.id,
      plan: "pro_student",
      status: "active",
    }).onConflictDoNothing();
    console.log("Created student: student@gcctbc.com / Student@1234");
  }

  // Create a batch
  if (instituteId) {
    await db.insert(batchesTable).values({
      name: "Batch A - Morning",
      instituteId,
      description: "Morning batch for 30 WPM students",
    }).onConflictDoNothing();
    console.log("Created batch: Batch A - Morning");
  }

  // English passages
  const englishPassages = [
    {
      title: "The Art of Typing",
      content: "Typing is a skill that has become essential in today's digital world. The ability to type quickly and accurately can significantly improve your productivity and open up many career opportunities. Whether you are a student, a professional, or simply someone who spends time on a computer, learning to type well is a valuable investment. Practice regularly and focus on accuracy before speed, as good habits formed early will serve you throughout your life.",
      language: "english",
      difficulty: "easy",
      speedCategory: 30,
    },
    {
      title: "The Importance of Digital Skills",
      content: "In the modern era of technology and digital transformation, possessing strong digital skills is no longer optional but a necessity for every individual seeking professional growth. From basic computer literacy to advanced programming knowledge, the spectrum of digital competencies that employers seek has expanded dramatically. Typing proficiency remains one of the foundational digital skills that enables efficient communication and data processing across all industries.",
      language: "english",
      difficulty: "medium",
      speedCategory: 40,
    },
    {
      title: "Benefits of Regular Typing Practice",
      content: "Regular typing practice offers numerous benefits beyond just improving speed. It enhances your ability to focus and concentrate for extended periods, reduces the cognitive load of thinking about key positions, and allows your thoughts to flow more naturally onto the screen. Professional typists report that fluent typing helps them think more clearly while writing, as the mechanical aspect becomes automatic and no longer interrupts their thought processes or creative flow.",
      language: "english",
      difficulty: "medium",
      speedCategory: 50,
    },
    {
      title: "Advanced Typing Techniques",
      content: "Advanced typing techniques encompass not just finger placement and speed but also ergonomics and sustainability of practice. Proper posture, appropriate keyboard height, and regular breaks are essential components of professional typing. The touch typing method, where typists rely on muscle memory rather than visual confirmation of key positions, represents the pinnacle of typing efficiency. Mastering this technique requires dedicated practice but yields remarkable improvements in both speed and accuracy.",
      language: "english",
      difficulty: "hard",
      speedCategory: 60,
    },
  ];

  // Hindi passages (using Devanagari script)
  const hindiPassages = [
    {
      title: "टाइपिंग का महत्व",
      content: "आज के डिजिटल युग में टाइपिंग एक अत्यंत महत्वपूर्ण कौशल बन गई है। कंप्यूटर पर तेज और सटीक टाइप करने की क्षमता आपकी कार्यक्षमता को काफी बढ़ा सकती है। हिंदी टाइपिंग सीखने से आप सरकारी नौकरियों के लिए बेहतर तैयारी कर सकते हैं। नियमित अभ्यास से आप अपनी गति और शुद्धता दोनों में सुधार कर सकते हैं।",
      language: "hindi",
      difficulty: "easy",
      speedCategory: 30,
    },
    {
      title: "भारत की संस्कृति",
      content: "भारत एक विविधताओं से भरा देश है जहाँ अनेक भाषाएँ, धर्म और संस्कृतियाँ एक साथ फलती-फूलती हैं। यहाँ की समृद्ध सांस्कृतिक विरासत हजारों वर्षों पुरानी है। भारत के विभिन्न राज्यों में अलग-अलग परंपराएँ, त्योहार और खान-पान की विशेषताएँ पाई जाती हैं। यह विविधता ही भारत को एक अनूठा और विशेष राष्ट्र बनाती है।",
      language: "hindi",
      difficulty: "medium",
      speedCategory: 40,
    },
  ];

  // Marathi passages
  const marathiPassages = [
    {
      title: "महाराष्ट्राची ओळख",
      content: "महाराष्ट्र हे भारताच्या पश्चिम भागातील एक प्रमुख राज्य आहे. येथील समृद्ध सांस्कृतिक परंपरा, छत्रपती शिवाजी महाराजांचा इतिहास आणि वारी परंपरा जगभर प्रसिद्ध आहे. मराठी भाषा ही महाराष्ट्राची राज्य भाषा असून ती अत्यंत समृद्ध आणि प्राचीन आहे. टाइपिंग या भाषेत शिकणे सरकारी नोकऱ्यांसाठी उपयुक्त ठरते.",
      language: "marathi",
      difficulty: "easy",
      speedCategory: 30,
    },
    {
      title: "मराठी साहित्याची परंपरा",
      content: "मराठी साहित्याची परंपरा अनेक शतके जुनी आहे. संत ज्ञानेश्वर, संत तुकाराम, संत एकनाथ यांनी मराठी साहित्याला एक उच्च स्थान प्राप्त करून दिले. आधुनिक काळात मराठी साहित्यात विपुल रचना होत आहेत. मराठी कादंबऱ्या, कविता आणि नाटके देश-विदेशात प्रसिद्ध आहेत. या समृद्ध परंपरेचे जतन करणे आपले कर्तव्य आहे.",
      language: "marathi",
      difficulty: "medium",
      speedCategory: 40,
    },
  ];

  const allPassages = [...englishPassages, ...hindiPassages, ...marathiPassages];

  for (const p of allPassages) {
    const wordCount = p.content.trim().split(/\s+/).filter(Boolean).length;
    await db.insert(passagesTable).values({
      ...p,
      wordCount,
      isActive: true,
    }).onConflictDoNothing();
  }
  console.log(`Seeded ${allPassages.length} passages`);

  console.log("\n✅ Seeding complete!");
  console.log("\nDemo accounts:");
  console.log("  admin@gcctbc.com    / Admin@1234    (Super Admin)");
  console.log("  teacher@gcctbc.com  / Teacher@1234  (Teacher)");
  console.log("  student@gcctbc.com  / Student@1234  (Student)");

  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
