import json, os, math
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoTokenizer

EMBED_DIM = 256
NUM_HEADS = 4
NUM_LAYERS = 4
FFN_DIM = 512
MAX_SEQ_LEN = 48
DROPOUT = 0.2
MODEL_DIR = "model_output"

device = torch.device("cpu")

tokenizer = AutoTokenizer.from_pretrained("aubmindlab/aragpt2-base", local_files_only=True)
VOCAB_SIZE = len(tokenizer.get_vocab())
PAD_ID = tokenizer.pad_token_id
if PAD_ID is None:
    tokenizer.pad_token = tokenizer.eos_token
    PAD_ID = tokenizer.pad_token_id

print(f"Vocab: {VOCAB_SIZE}, PAD: {PAD_ID}")

with open("dataset/intents.json", "r", encoding="utf-8") as f:
    intent_names = json.load(f)
NUM_LABELS = len(intent_names)
print(f"Classes: {NUM_LABELS}")

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
            d_model=embed_dim, nhead=num_heads, dim_feedforward=ffn_dim,
            dropout=dropout, activation="gelu", batch_first=True, norm_first=True
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
        src_key_padding_mask = ~attention_mask.bool()
        x = self.transformer(x, src_key_padding_mask=src_key_padding_mask)
        mask = attention_mask.unsqueeze(-1).float()
        x = (x * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)
        return self.classifier(x)

model = ArabicIntentTransformer(
    vocab_size=VOCAB_SIZE, embed_dim=EMBED_DIM, num_heads=NUM_HEADS,
    num_layers=NUM_LAYERS, ffn_dim=FFN_DIM, max_len=MAX_SEQ_LEN,
    num_labels=NUM_LABELS, dropout=DROPOUT
).to(device)

# Load saved weights
ckpt = torch.load(f"{MODEL_DIR}/best_model.pt", map_location=device, weights_only=True)
model.load_state_dict(ckpt)
model.eval()
print("Model loaded successfully")

# Verify with test inference
test_texts = [
    "المصعد لا يعمل أريد تقديم بلاغ",
    "أريد الاستفسار عن عقد الصيانة",
    "طلب صيانة عاجل",
    "أظهر تقرير زيارة الصيانة",
    "شغل المصعد من فضلك",
    "كم عدد المصاعد في المبنى؟",
    "أخبرني نكتة",
]
print("\nTest inferences:")
for text in test_texts:
    enc = tokenizer(text, max_length=MAX_SEQ_LEN, padding="max_length", truncation=True, return_tensors="pt")
    with torch.no_grad():
        logits = model(enc["input_ids"], enc["attention_mask"])
        probs = F.softmax(logits, dim=1)
        pred = torch.argmax(probs, dim=1).item()
        conf = probs[0][pred].item()
    print(f"  '{text}' -> {intent_names[pred]} ({conf:.2%})")

# Export to ONNX
print("\nExporting to ONNX...")
dummy_input_ids = torch.randint(0, VOCAB_SIZE-1, (1, MAX_SEQ_LEN), dtype=torch.long).to(device)
dummy_attention_mask = torch.ones(1, MAX_SEQ_LEN, dtype=torch.long).to(device)

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

# Save labels and config
with open(f"{MODEL_DIR}/labels.json", "w", encoding="utf-8") as f:
    json.dump(intent_names, f, ensure_ascii=False, indent=2)

config = {
    "vocab_size": VOCAB_SIZE, "embed_dim": EMBED_DIM, "num_heads": NUM_HEADS,
    "num_layers": NUM_LAYERS, "ffn_dim": FFN_DIM, "max_seq_len": MAX_SEQ_LEN,
    "dropout": DROPOUT, "num_labels": NUM_LABELS, "pad_token_id": PAD_ID,
    "model_type": "ArabicIntentTransformer", "tokenizer": "aubmindlab/aragpt2-base"
}
with open(f"{MODEL_DIR}/config.json", "w", encoding="utf-8") as f:
    json.dump(config, f, ensure_ascii=False, indent=2)

tokenizer.save_pretrained(MODEL_DIR)

# Quantize
try:
    import onnx
    from onnxruntime.quantization import quantize_dynamic, QuantType
    print("Applying INT8 quantization...")
    quantize_dynamic(f"{MODEL_DIR}/model.onnx", f"{MODEL_DIR}/model_quantized.onnx", weight_type=QuantType.QInt8)
    orig = os.path.getsize(f"{MODEL_DIR}/model.onnx")
    quant = os.path.getsize(f"{MODEL_DIR}/model_quantized.onnx")
    print(f"Original: {orig/1024/1024:.1f}MB -> Quantized: {quant/1024/1024:.1f}MB")
    os.replace(f"{MODEL_DIR}/model_quantized.onnx", f"{MODEL_DIR}/model.onnx")
except Exception as e:
    print(f"Quantization skipped: {e}")

model_size = os.path.getsize(f"{MODEL_DIR}/model.onnx")
print(f"Final ONNX model: {model_size/1024/1024:.1f}MB")
print(f"Files in {MODEL_DIR}/:")
for f in os.listdir(MODEL_DIR):
    fp = os.path.join(MODEL_DIR, f)
    print(f"  {f}: {os.path.getsize(fp)} bytes" if os.path.isfile(fp) else f"  {f}/")
print("\n[*] Export complete!")
