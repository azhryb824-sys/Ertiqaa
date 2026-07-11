"""
Lightweight Arabic Intent Classifier - Training Pipeline
Trains a small Transformer encoder from scratch using aragpt2's BPE tokenizer.
Exports to ONNX with INT8 quantization for production inference.
"""
import json, os, time, math, sys
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset
from transformers import AutoTokenizer

# ============= CONFIG =============
EMBED_DIM = 256
NUM_HEADS = 4
NUM_LAYERS = 4
FFN_DIM = 512
MAX_SEQ_LEN = 48
DROPOUT = 0.2
NUM_EPOCHS = 8
BATCH_SIZE = 32
LEARNING_RATE = 5e-4
WEIGHT_DECAY = 1e-4
PATIENCE = 3
MODEL_DIR = "model_output"
# ==================================

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device: {device}")

# Load tokenizer (from cached aragpt2-base)
print("Loading Arabic BPE tokenizer (aragpt2-base)...")
tokenizer = AutoTokenizer.from_pretrained("aubmindlab/aragpt2-base", local_files_only=True)
VOCAB_SIZE = len(tokenizer.get_vocab())
PAD_ID = tokenizer.pad_token_id
if PAD_ID is None:
    tokenizer.pad_token = tokenizer.eos_token
    PAD_ID = tokenizer.pad_token_id
print(f"Vocab size: {VOCAB_SIZE}, PAD ID: {PAD_ID}")

# Load dataset
print("Loading dataset...")
with open("dataset/train.json", "r", encoding="utf-8") as f:
    train_data = json.load(f)
with open("dataset/test.json", "r", encoding="utf-8") as f:
    test_data = json.load(f)
with open("dataset/intents.json", "r", encoding="utf-8") as f:
    intent_names = json.load(f)

NUM_LABELS = len(intent_names)
print(f"Number of classes: {NUM_LABELS}")
print(f"Classes: {intent_names}")

# ---------- Dataset ----------
class IntentDataset(Dataset):
    def __init__(self, data, tokenizer, max_len):
        self.data = data
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        item = self.data[idx]
        text = item["text"]
        label = item["label_id"]
        encoding = self.tokenizer(
            text,
            max_length=self.max_len,
            padding="max_length",
            truncation=True,
            return_tensors="pt"
        )
        return {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "label": torch.tensor(label, dtype=torch.long)
        }

train_dataset = IntentDataset(train_data, tokenizer, MAX_SEQ_LEN)
test_dataset = IntentDataset(test_data, tokenizer, MAX_SEQ_LEN)
train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE)

# ---------- Model ----------
class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=512):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        pos = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div = torch.exp(torch.arange(0, d_model, 2, dtype=torch.float) * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(pos * div)
        pe[:, 1::2] = torch.cos(pos * div)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x):
        return x + self.pe[:, :x.size(1)]

class ArabicIntentTransformer(nn.Module):
    def __init__(self, vocab_size, embed_dim, num_heads, num_layers, ffn_dim, max_len, num_labels, dropout):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=PAD_ID)
        self.pos_encoding = PositionalEncoding(embed_dim, max_len)
        self.dropout = nn.Dropout(dropout)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim,
            nhead=num_heads,
            dim_feedforward=ffn_dim,
            dropout=dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.classifier = nn.Sequential(
            nn.Linear(embed_dim, embed_dim // 2),
            nn.LayerNorm(embed_dim // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(embed_dim // 2, num_labels)
        )

    def forward(self, input_ids, attention_mask):
        x = self.embedding(input_ids)
        x = self.pos_encoding(x)
        x = self.dropout(x)
        # Convert attention_mask to bool and create src_key_padding_mask
        src_key_padding_mask = ~attention_mask.bool()
        x = self.transformer(x, src_key_padding_mask=src_key_padding_mask)
        # Pool using attention mask
        mask = attention_mask.unsqueeze(-1).float()
        x = (x * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)
        return self.classifier(x)

model = ArabicIntentTransformer(
    vocab_size=VOCAB_SIZE,
    embed_dim=EMBED_DIM,
    num_heads=NUM_HEADS,
    num_layers=NUM_LAYERS,
    ffn_dim=FFN_DIM,
    max_len=MAX_SEQ_LEN,
    num_labels=NUM_LABELS,
    dropout=DROPOUT
).to(device)

total_params = sum(p.numel() for p in model.parameters())
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"Total params: {total_params:,} ({total_params*4/1024/1024:.1f}MB FP32)")
print(f"Trainable params: {trainable_params:,}")

# ---------- Training ----------
optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=NUM_EPOCHS)
best_loss = float("inf")
patience_counter = 0

criterion = nn.CrossEntropyLoss()

print(f"\nTraining for {NUM_EPOCHS} epochs...")
start_time = time.time()
for epoch in range(NUM_EPOCHS):
    model.train()
    train_loss = 0
    correct = 0
    total = 0
    for batch in train_loader:
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        labels = batch["label"].to(device)

        optimizer.zero_grad()
        outputs = model(input_ids, attention_mask)
        loss = criterion(outputs, labels)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        train_loss += loss.item()
        _, predicted = torch.max(outputs, 1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()

    scheduler.step()
    train_acc = 100 * correct / total
    avg_loss = train_loss / len(train_loader)

    # Evaluate
    model.eval()
    test_loss = 0
    test_correct = 0
    test_total = 0
    with torch.no_grad():
        for batch in test_loader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["label"].to(device)
            outputs = model(input_ids, attention_mask)
            loss = criterion(outputs, labels)
            test_loss += loss.item()
            _, predicted = torch.max(outputs, 1)
            test_total += labels.size(0)
            test_correct += (predicted == labels).sum().item()

    test_acc = 100 * test_correct / test_total
    test_avg = test_loss / len(test_loader)

    elapsed = time.time() - start_time
    print(f"Epoch {epoch+1:2d}/{NUM_EPOCHS} | Train Loss: {avg_loss:.4f} Acc: {train_acc:.1f}% | Test Loss: {test_avg:.4f} Acc: {test_acc:.1f}% | LR: {scheduler.get_last_lr()[0]:.2e} | {elapsed:.0f}s")

    # Early stopping
    if test_avg < best_loss:
        best_loss = test_avg
        patience_counter = 0
        torch.save(model.state_dict(), f"{MODEL_DIR}/best_model.pt")
        print(f"  [*] New best model saved (loss: {best_loss:.4f})")
    else:
        patience_counter += 1
        if patience_counter >= PATIENCE:
            print(f"Early stopping at epoch {epoch+1}")
            break

# Load best
model.load_state_dict(torch.load(f"{MODEL_DIR}/best_model.pt", map_location=device, weights_only=True))
print(f"\nBest model test loss: {best_loss:.4f}")

# Final evaluation
model.eval()
all_preds = []
all_labels = []
with torch.no_grad():
    for batch in test_loader:
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        labels = batch["label"].to(device)
        outputs = model(input_ids, attention_mask)
        probs = F.softmax(outputs, dim=1)
        _, predicted = torch.max(outputs, 1)
        all_preds.extend(predicted.cpu().numpy())
        all_labels.extend(labels.cpu().numpy())

from sklearn.metrics import classification_report, confusion_matrix
print("\nClassification Report:")
print(classification_report(all_labels, all_preds, target_names=intent_names))
print("\nConfusion Matrix:")
cm = confusion_matrix(all_labels, all_preds)
print(np.array2string(cm))

# Save metrics
os.makedirs(MODEL_DIR, exist_ok=True)
metrics = {
    "best_test_loss": best_loss,
    "accuracy": float((np.array(all_preds) == np.array(all_labels)).mean()),
    "num_params": total_params,
    "model_size_mb": total_params * 4 / 1024 / 1024,
    "intents": intent_names,
    "num_intents": NUM_LABELS,
    "training_samples": len(train_data),
    "test_samples": len(test_data),
    "epochs_trained": epoch + 1
}
with open(f"{MODEL_DIR}/metrics.json", "w", encoding="utf-8") as f:
    json.dump(metrics, f, ensure_ascii=False, indent=2)
print(f"\nMetrics saved to {MODEL_DIR}/metrics.json")

# ============= ONNX Export =============
print("\nExporting to ONNX...")
model.eval()
dummy_input_ids = torch.randint(0, VOCAB_SIZE-1, (1, MAX_SEQ_LEN), dtype=torch.long).to(device)
dummy_attention_mask = torch.ones(1, MAX_SEQ_LEN, dtype=torch.long).to(device)

with torch.no_grad():
    torch.onnx.export(
        model,
        (dummy_input_ids, dummy_attention_mask),
        f"{MODEL_DIR}/model.onnx",
        input_names=["input_ids", "attention_mask"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch_size"},
            "attention_mask": {0: "batch_size"},
            "logits": {0: "batch_size"}
        },
        opset_version=17,
        do_constant_folding=True
    )

# Save label mapping
with open(f"{MODEL_DIR}/labels.json", "w", encoding="utf-8") as f:
    json.dump(intent_names, f, ensure_ascii=False, indent=2)

# Save config
config = {
    "vocab_size": VOCAB_SIZE,
    "embed_dim": EMBED_DIM,
    "num_heads": NUM_HEADS,
    "num_layers": NUM_LAYERS,
    "ffn_dim": FFN_DIM,
    "max_seq_len": MAX_SEQ_LEN,
    "dropout": DROPOUT,
    "num_labels": NUM_LABELS,
    "pad_token_id": PAD_ID,
    "model_type": "ArabicIntentTransformer",
    "tokenizer": "aubmindlab/aragpt2-base"
}
with open(f"{MODEL_DIR}/config.json", "w", encoding="utf-8") as f:
    json.dump(config, f, ensure_ascii=False, indent=2)

# Also save tokenizer files for production
tokenizer.save_pretrained(MODEL_DIR)

# Quantize ONNX
try:
    import onnx
    from onnxruntime.quantization import quantize_dynamic, QuantType
    print("Applying INT8 quantization...")
    quantize_dynamic(
        f"{MODEL_DIR}/model.onnx",
        f"{MODEL_DIR}/model_quantized.onnx",
        weight_type=QuantType.QInt8
    )
    # Use quantized as default
    os.replace(f"{MODEL_DIR}/model_quantized.onnx", f"{MODEL_DIR}/model.onnx")
    print("Quantized model saved")
except Exception as e:
    print(f"Quantization skipped: {e}")

model_size = os.path.getsize(f"{MODEL_DIR}/model.onnx")
print(f"ONNX model size: {model_size/1024/1024:.1f}MB")
print(f"Model saved to {MODEL_DIR}/")
print("\n[*] Training complete!")
