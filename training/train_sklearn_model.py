import json, re, math, os
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, accuracy_score
import joblib

# Load dataset
with open("dataset/train.json", "r", encoding="utf-8") as f:
    train_data = json.load(f)
with open("dataset/test.json", "r", encoding="utf-8") as f:
    test_data = json.load(f)
with open("dataset/intents.json", "r", encoding="utf-8") as f:
    intent_names = json.load(f)

print(f"Train: {len(train_data)}, Test: {len(test_data)}, Intents: {intent_names}")

X_train = [d["text"] for d in train_data]
y_train = [d["label_id"] for d in train_data]
X_test = [d["text"] for d in test_data]
y_test = [d["label_id"] for d in test_data]

# Normalize Arabic text
def normalize(text):
    text = text.lower()
    text = re.sub(r'[إأآا]', 'ا', text)
    text = re.sub(r'[ىي]', 'ي', text)
    text = re.sub(r'[ة]', 'ه', text)
    text = re.sub(r'[\u064B-\u065F]', '', text)  # Remove tashkeel
    text = re.sub(r'[^\w\s\u0600-\u06FFa-zA-Z]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

X_train_norm = [normalize(t) for t in X_train]
X_test_norm = [normalize(t) for t in X_test]

# Train with character n-grams + TF-IDF + Logistic Regression
print("\nTraining pipeline...")
pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(
        analyzer='char',
        ngram_range=(2, 5),
        max_features=8000,
        sublinear_tf=True,
        use_idf=True,
        norm='l2'
    )),
    ('clf', LogisticRegression(
        C=2.0,
        solver='lbfgs',
        max_iter=1000,
        random_state=42
    ))
])

pipeline.fit(X_train_norm, y_train)

# Evaluate
y_pred = pipeline.predict(X_test_norm)
acc = accuracy_score(y_test, y_pred)
print(f"\nTest Accuracy: {acc:.4f} ({acc*100:.2f}%)")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=intent_names))

# Per-intent accuracy
from sklearn.metrics import confusion_matrix
cm = confusion_matrix(y_test, y_pred)
print("\nPer-intent accuracy:")
for i, name in enumerate(intent_names):
    total = cm[i].sum()
    correct = cm[i][i]
    print(f"  {name}: {correct}/{total} = {correct/total*100:.1f}%")

# Export model components as JSON for JS inference
vectorizer = pipeline.named_steps['tfidf']
clf = pipeline.named_steps['clf']

vocab = vectorizer.vocabulary_
idf = vectorizer.idf_.tolist()

# Convert vocabulary to sorted list
vocab_list = sorted(vocab.keys(), key=lambda x: vocab[x])
vocab_index = {w: i for i, w in enumerate(vocab_list)}

model_export = {
    "vocab": vocab_list,
    "idf": idf,
    "coef": clf.coef_.tolist(),
    "intercept": clf.intercept_.tolist(),
    "classes": ["إنشاء بلاغ", "استفسار عن عقد", "طلب صيانة", "تقرير زيارة", "أمر تشغيل", "استعلام عام", "رفض"],
    "ngram_range": [2, 5],
    "max_features": 8000,
    "sublinear_tf": True,
    "norm": "l2",
    "accuracy": float(acc),
    "model_type": "tfidf_logistic_regression",
    "description": "Arabic elevator intent classifier - character n-gram TF-IDF + Multinomial Logistic Regression"
}

os.makedirs("model_output", exist_ok=True)
with open("model_output/sklearn_model.json", "w", encoding="utf-8") as f:
    json.dump(model_export, f, ensure_ascii=False)

# Also save full pipeline for Python inference
joblib.dump(pipeline, "model_output/pipeline.joblib")

model_size = os.path.getsize("model_output/sklearn_model.json")
print(f"\nModel exported: {model_size/1024:.1f}KB")

# Test inference on sample texts
print("\nSample inferences:")
test_samples = [
    "المصعد لا يعمل أريد تقديم بلاغ",
    "أريد الاستفسار عن عقد الصيانة",
    "طلب صيانة عاجل",
    "أظهر تقرير زيارة الصيانة",
    "شغل المصعد من فضلك",
    "كم عدد المصاعد في المبنى؟",
    "أخبرني نكتة",
    "المصعد واقف بين الأدوار بلاغ عاجل",
    "متى ينتهي عقد الصيانة؟",
    "المصعد يصدر صوت غريب",
    "ابغى تقرير الزيارة الأخيرة",
    "شغل المصعد بعد الصيانة",
    "كيف أستخدم المصعد في الطوارئ؟",
    "أنت غبي",
    "ما هو الطقس اليوم؟"
]

for text in test_samples:
    norm = normalize(text)
    proba = pipeline.predict_proba([norm])[0]
    pred = np.argmax(proba)
    conf = proba[pred]
    print(f"  '{text}' -> {intent_names[pred]} ({conf:.2%})")

print("\n[*] Training complete!")
