# Shumoos AI Model Technical Report

## Current Production Mode

The production system is configured as **Inference Only**.

End users can send questions and operational commands, but they cannot train, retrain, fine-tune, upload training data, change model weights, or modify model internals from inside the application.

## Approved Runtime Model

- Version: `Shumoos-AI-v1.0-inference`
- Runtime mode: `inference-only`
- Weights status: frozen in production
- User training: disabled
- Developer training: external/offline only
- Specialization: Arabic elevator maintenance and installation operations

The application uses the approved runtime model/profile to understand Arabic user requests, preserve conversation context, enforce permissions, and execute allowed elevator-company workflows.

## Current Architecture Review

The previous implementation mixed several layers:

- Hosted or external LLM inference.
- Local rule-based intent extraction.
- Local operational execution functions.
- Response-style adaptation from recent AI memory.
- User-visible controls that looked like training or model testing.

This has now been corrected for production behavior:

- User-visible training/testing controls were removed.
- Feedback no longer implies automatic training.
- The AI status shown to users now states that the system is using an approved inference model.
- Local client-side action execution is no longer used before the approved server AI route for chat/admin requests.
- Vague service requests are handled by the AI employee service response instead of a static zero-data system summary.

## Training Policy

Training must happen only in a separate developer environment.

Allowed developer-side lifecycle:

1. Collect approved and sanitized examples.
2. Remove personal, customer, and sensitive operational data.
3. Split data into train, validation, and test sets.
4. Train or fine-tune outside production.
5. Evaluate Arabic understanding, intent extraction, permission compliance, hallucination rate, latency, and task success.
6. Freeze and version the approved model.
7. Deploy the approved inference artifact.
8. Monitor behavior without changing weights automatically.

## Production Restrictions

Production must not expose:

- Train model buttons.
- Retrain model buttons.
- Fine-tuning controls.
- LoRA/QLoRA controls.
- Dataset upload for model training.
- Weight or hyperparameter settings.
- Any page that lets end users affect model weights or internal architecture.

## Feedback Handling

User feedback may be stored for developer review only.

It does not automatically train the model, update weights, alter prompts, or change the deployed inference behavior.

## Remaining Constraint

This repository does not currently contain real fine-tuned model weight files or verifiable training logs/loss curves. The production correction made here enforces the correct inference-only behavior and removes misleading user training controls. A true trained model artifact still requires an external developer training pipeline and approved model weights before it can be honestly reported as fully fine-tuned.

