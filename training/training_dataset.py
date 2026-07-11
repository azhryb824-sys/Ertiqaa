import json, os, random

random.seed(42)

INTENTS = {
    "إنشاء_بلاغ": 0,
    "استفسار_عقد": 1,
    "طلب_صيانة": 2,
    "تقرير_زيارة": 3,
    "أمر_تشغيل": 4,
    "استعلام_عام": 5,
    "رفض": 6
}

INTENT_NAMES = list(INTENTS.keys())
NUM_LABELS = len(INTENTS)

TRAINING_EXAMPLES = {
    "إنشاء_بلاغ": [
        "أريد تقديم بلاغ عطل في المصعد",
        "المصعد لا يعمل أريد تقديم بلاغ",
        "عطل في المصعد الرجاء تسجيل بلاغ",
        "المصعد الكهربائي معطل أريد الإبلاغ",
        "تقديم بلاغ عطل مصعد",
        "الإبلاغ عن عطل في المصعد",
        "تسجيل بلاغ عطل في المصعد رقم 3",
        "أريد عمل بلاغ عطل المصعد لا يعمل",
        "المصعد عطلان أريد تقديم بلاغ",
        "بلاغ عطل مصعد الرجاء المساعدة",
        "توقف المصعد عن العمل أبلغ",
        "أبلغ عن عطل في المصعد الرئيسي",
        "المصعد لا يفتح أريد بلاغ",
        "الإبلاغ عن عطل مصعد في المبنى",
        "تسجيل بلاغ عطل مصعد البطحاء",
        "عطل المصعد الكهربائي سكن الموظفين",
        "المصعد معطل من يومين أريد بلاغ",
        "تقديم شكوى عطل مصعد",
        "المصعد يصدر صوت غريب أريد الإبلاغ",
        "باب المصعد لا يغلق أبلغ فضلاً",
        "المصعد واقف بين الأدوار, بلاغ عاجل",
        "الرجاء تسجيل بلاغ لمصعد العمارة",
        "عطل المصعد الرئيسي مبنى الإدارة",
        "تسجيل بلاغ تعطل مصعد الركاب",
        "إبلاغ عن عطل مصعد المستودع",
        "Lift is broken, submit report",
        "Elevator malfunction report needed",
        "Report elevator fault in building A",
        "There is a problem with the lift",
        "Need to report elevator breakdown"
    ],
    "استفسار_عقد": [
        "أريد الاستفسار عن عقد الصيانة",
        "استفسار عن بنود العقد",
        "عقد الصيانة متى ينتهي؟",
        "هل يوجد تجديد عقد صيانة؟",
        "أرغب في معرفة تفاصيل عقد المصعد",
        "استفسار عقد صيانة المصاعد",
        "متى ينتهي عقد الصيانة الحالي؟",
        "كم مدة العقد المتبقية؟",
        "أريد نسخة من العقد",
        "هل العقد يشمل قطع الغيار؟",
        "بنود العقد وشروط الصيانة",
        "أستفسر عن سعر عقد الصيانة",
        "تجديد عقد صيانة المصعد",
        "هل يمكن تعديل العقد؟",
        "ارفاق العقد من فضلك",
        "Contract inquiry about maintenance",
        "When does the contract expire?",
        "I need contract details for the elevator",
        "Contract renewal terms please",
        "Show me the maintenance contract"
    ],
    "طلب_صيانة": [
        "أريد طلب صيانة للمصعد",
        "طلب صيانة عاجل المصعد لا يعمل",
        "صيانة مصعد الرجاء الحضور",
        "المصعد بحاجة صيانة دورية",
        "طلب صيانة للمصعد الكهربائي",
        "أحتاج فني صيانة مصعد",
        "طلب صيانة عاجلة المصعد عالق",
        "صيانة المصعد الرجاء الإسراع",
        "طلب صيانة مصعد الركاب",
        "جدول صيانة دورية للمصاعد",
        "أبلغ عن حاجة صيانة مصعد",
        "صيانة عاجلة المصعد لا يتحرك",
        "Request maintenance for elevator",
        "Elevator needs urgent maintenance",
        "Schedule maintenance visit please",
        "Maintenance request for lift system",
        "Need technician for elevator repair",
        "Urgent: elevator stuck between floors"
    ],
    "تقرير_زيارة": [
        "أريد تقرير زيارة الصيانة",
        "تقرير الزيارة الأخيرة للمصعد",
        "أظهر تقرير زيارة الصيانة",
        "هل تمت زيارة الصيانة الدورية؟",
        "تقرير زيارات الصيانة السابقة",
        "متى آخر زيارة صيانة؟",
        "تقرير حالة المصعد بعد الصيانة",
        "سجل زيارات الصيانة للمصعد",
        "أريد رؤية تقرير الصيانة الأخير",
        "إظهار تقارير زيارات الصيانة",
        "ماذا وجد الفني في الزيارة الأخيرة؟",
        "آخر تقرير زيارة للمصعد",
        "تقرير الفحص الدوري للمصعد",
        "تفاصيل زيارة الصيانة الماضية",
        "أظهر سجل الصيانة للمصعد",
        "Show last maintenance visit report",
        "Elevator service visit report",
        "Previous inspection report needed",
        "When was the last maintenance visit?",
        "Display maintenance history report"
    ],
    "أمر_تشغيل": [
        "شغل المصعد من فضلك",
        "أوقف المصعد للتفتيش",
        "تشغيل المصعد بعد الصيانة",
        "إعادة تشغيل المصعد",
        "تشغيل المصعد الكهربائي",
        "أمر بتشغيل المصعد الرئيسي",
        "إيقاف تشغيل المصعد للصيانة",
        "تشغيل المصعد للطوارئ",
        "بدء تشغيل المصعد بعد التعطل",
        "أوقف المصعد في الطابق الأرضي",
        "إعادة تشغيل نظام المصعد",
        "تشغيل المصعد يدوياً",
        "Shut down elevator for maintenance",
        "Start the elevator after repair",
        "Turn on the elevator system",
        "Restart the lift mechanism",
        "Operate the elevator manually"
    ],
    "استعلام_عام": [
        "كم عدد المصاعد في المبنى؟",
        "أين يوجد مصعد الشحن؟",
        "ما هي سعة المصعد؟",
        "المصعد متى تم تركيبه؟",
        "كم طابق يخدم المصعد؟",
        "هل يوجد مصعد للطوارئ؟",
        "ما هي سرعة المصعد؟",
        "من هي شركة الصيانة؟",
        "هل يوجد مصعد مخصص للبضائع؟",
        "كيف أستخدم المصعد في الطوارئ؟",
        "ما هو نوع المصعد؟",
        "كم شخص يسع المصعد؟",
        "هل المصعد يعمل بالطاقة الشمسية؟",
        "مواصفات المصعد الكهربائي",
        "How many floors does the elevator serve?",
        "What is the elevator capacity?",
        "Who is the maintenance company?",
        "Elevator installation date?",
        "Is there a freight elevator?"
    ],
    "رفض": [
        "أنت غبي",
        "اكتب لي أغنية",
        "من هو رئيس روسيا؟",
        "أخبرني نكتة",
        "كيف أصنع قنبلة؟",
        "ترجمة هذا النص للإنجليزية",
        "اكتب قصيدة عن المصاعد",
        "ما هو الطقس اليوم؟",
        "من فاز بكأس العالم؟",
        "How to hack a website",
        "Write me a poem",
        "Tell me a joke",
        "What is the weather?",
        "أكل التفاح صحي",
        "ما هي عاصمة فرنسا؟"
    ]
}

def augment_text(text):
    augmentations = []
    # Add filler words
    fillers = ['من فضلك', 'لو سمحت', 'الرجاء', 'فضلاً', 'أرجوك', '']
    for f in fillers:
        if f:
            augmentations.append(f"{f} {text}")
            augmentations.append(f"{text} {f}")
    # Add "أريد" variations
    prefixes = ['أريد', 'أرغب في', 'أحتاج', 'أتمنى', 'أود', '']
    for p in prefixes:
        if p and not text.startswith(p):
            augmentations.append(f"{p} {text[0].lower() + text[1:]}" if text else text)
    # Add "السلام عليكم" prefix
    greetings = ['السلام عليكم', 'مرحباً', 'صباح الخير', 'مساء الخير', '']
    for g in greetings:
        if g and g != '':
            augmentations.append(f"{g}، {text}")
    return augmentations

samples = []
for intent, examples in TRAINING_EXAMPLES.items():
    label_id = INTENTS[intent]
    for ex in examples:
        samples.append({"text": ex, "label": intent, "label_id": label_id})
        # Add augmented versions
        for aug in augment_text(ex):
            clean = aug.strip().strip('،').strip()
            if clean and len(clean) > 3:
                samples.append({"text": clean, "label": intent, "label_id": label_id})

# Shuffle and deduplicate by text
random.shuffle(samples)
seen = set()
unique = []
for s in samples:
    if s["text"] not in seen:
        seen.add(s["text"])
        unique.append(s)

samples = unique
random.shuffle(samples)

# Split
split = int(len(samples) * 0.85)
train = samples[:split]
test = samples[split:]

print(f"Total samples: {len(samples)}")
print(f"Train: {len(train)}, Test: {len(test)}")
for intent in INTENTS:
    cnt = sum(1 for s in samples if s["label"] == intent)
    print(f"  {intent}: {cnt}")

os.makedirs("dataset", exist_ok=True)
with open("dataset/train.json", "w", encoding="utf-8") as f:
    json.dump(train, f, ensure_ascii=False, indent=2)
with open("dataset/test.json", "w", encoding="utf-8") as f:
    json.dump(test, f, ensure_ascii=False, indent=2)
with open("dataset/intents.json", "w", encoding="utf-8") as f:
    json.dump(INTENT_NAMES, f, ensure_ascii=False, indent=2)

print(f"\nDataset saved to dataset/")
