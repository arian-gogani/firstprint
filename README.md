# Firstprint

> **The birth certificate for everything AI creates.**

[![Tests](https://img.shields.io/badge/tests-55%2F55%20passing-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

Firstprint is a provenance protocol that gives every AI-generated artifact a structural identity, computes what's original about it, and enforces attribution when that originality is reproduced.

## How It Works

1. **Structural Fingerprinting** — Code is parsed into an AST, normalized (variable names stripped, literals removed), and structural features are extracted: subtree patterns, control flow graphs, dependency relationships, and logic patterns.

2. **Similarity-Preserving Hashing** — Features are hashed using MinHash (128-dimensional Jaccard estimator) and SimHash (64-bit cosine similarity), producing compact signatures that preserve structural similarity.

3. **Rarity-Weighted Comparison** — When comparing two fingerprints, common patterns (login + dashboard) get near-zero weight. Rare patterns (specific branching logic, unusual state machines) get high weight. What matters isn't similarity — it's the *improbability of co-occurrence*.

4. **Cryptographic Provenance** — Every fingerprint is signed with Ed25519, timestamped, and chained in an append-only Merkle ledger. This creates a tamper-proof record of what existed and when.

## Architecture

```
@firstprint/core       — Structural fingerprinting engine
@firstprint/compare    — Comparison & clone scoring
@firstprint/ledger     — Cryptographic provenance chain
@firstprint/rarity     — Pattern frequency corpus
@firstprint/api        — REST API server
@firstprint/web        — Public verification UI
```

## Quick Start

```bash
# Install dependencies
npm install

# Run the clone detection demo
npx tsx demo/detect-clone.ts

# Start the API server
npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/fingerprint` | Generate structural fingerprint from code |
| POST | `/compare` | Compare two code samples |
| POST | `/register` | Fingerprint + sign + ledger entry |
| POST | `/investigate` | Full forensic investigation |
| GET | `/verify/:id` | Verify a ledger entry |
| GET | `/health` | Health check |

## The Scoring System

Firstprint outputs a **derivation likelihood score**, not a binary judgment.

| Band | Score | Meaning |
|------|-------|---------|
| Convention | 0-30% | Normal industry patterns |
| Influence | 30-50% | Some distinctive overlap |
| Suspicious | 50-70% | Rare combinations align |
| High-confidence clone | 70-100% | Statistically implausible independent creation |

## Test Results

55/55 tests passing across 8 categories:

```
Exact clone (renamed):     ██████████████████████████████ 100.0%  → HIGH_CONFIDENCE_CLONE
Refactored clone:          ███████████████░░░░░░░░░░░░░░░  50.7%  → SUSPICIOUS
Partial clone (~50%):      ██████████████░░░░░░░░░░░░░░░░  47.1%  → INFLUENCE
Independent impl:          ███████████░░░░░░░░░░░░░░░░░░░  37.3%  → INFLUENCE
Unrelated code:            █████████░░░░░░░░░░░░░░░░░░░░░  28.8%  → CONVENTION
```

Score ordering is monotonic. Exact > Refactored > Partial > Independent > Unrelated. ✅

## License

MIT

Built by [Arian Gogani](https://github.com/arian-gogani).
