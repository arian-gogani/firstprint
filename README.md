# Firstprint

> **Search by logic, not by words.**

[![Tests](https://img.shields.io/badge/tests-74%2F74%20passing-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

Has this been done before? — Paste anything and instantly find every
structural equivalent on the internet.

Firstprint takes any digital artifact, strips the surface — names,
formatting, language, styling — and reveals the structural skeleton
underneath. Then it searches for structural equivalents: things that
*work the same way* regardless of how they look.

## Quick Start

```bash
git clone https://github.com/arian-gogani/firstprint
cd firstprint && npm install

# Scan a project
npx tsx packages/cli/src/cli.ts scan ./packages/core/src

# Check a single file
npx tsx packages/cli/src/cli.ts check ./packages/core/src/hash.ts

# Compare two projects
npx tsx packages/cli/src/cli.ts compare ./packages/core/src ./packages/compare/src

# Structural diff between two files
npx tsx packages/cli/src/cli.ts diff fileA.ts fileB.ts

# Register & get a birth certificate
npx tsx packages/cli/src/cli.ts register ./packages/core/src

# Run the clone detection demo
npx tsx demo/detect-clone.ts

# Run the full test suite
npx tsx tests/test-suite.ts
```

## Architecture

```
@firstprint/core       — Structural fingerprinting engine (AST, normalization, features)
@firstprint/compare    — Comparison, scoring, project comparison, structural diff
@firstprint/ledger     — Ed25519 cryptographic provenance chain
@firstprint/rarity     — Pattern frequency corpus & GitHub seeder
@firstprint/api        — REST API server (6 endpoints)
@firstprint/cli        — Command-line tool (5 commands)
@firstprint/web        — Public verification UI
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `firstprint scan <path>` | Fingerprint an entire project |
| `firstprint compare <a> <b>` | Compare two projects structurally |
| `firstprint check <file>` | Has this code been done before? |
| `firstprint register <path>` | Register + get birth certificate |
| `firstprint diff <a> <b>` | Structural diff between two files |

## How It Works

1. **Parse** — Tree-sitter converts code into an AST (TypeScript + Python)
2. **Normalize** — Strip variable names, literals, comments → structural skeleton
3. **Extract** — Pull features: AST subtrees, control flow, dependencies, logic patterns
4. **Hash** — MinHash (128-dim Jaccard) + SimHash (64-bit cosine similarity)
5. **Score** — Rarity-weighted comparison: common patterns ignored, rare overlaps highlighted
6. **Sign** — Ed25519 signature + Merkle chain = tamper-proof birth certificate

## Test Results

74/74 tests passing across 13 categories:

**Core suite (55 tests):** Hash functions, parser, normalizer, feature extraction,
5-scenario clone matrix, ledger integrity, tamper detection, determinism, edge cases, monotonicity.

**Project suite (19 tests):** Project fingerprinting, self-comparison, cross-package
comparison, ledger registration, determinism.

```
Exact clone (renamed):     ██████████████████████████████ 100.0%  → HIGH_CONFIDENCE_CLONE
Refactored clone:          ███████████████░░░░░░░░░░░░░░░  50.7%  → SUSPICIOUS
Partial clone (~50%):      ██████████████░░░░░░░░░░░░░░░░  47.1%  → INFLUENCE
Independent impl:          ███████████░░░░░░░░░░░░░░░░░░░  37.3%  → INFLUENCE
Unrelated code:            █████████░░░░░░░░░░░░░░░░░░░░░  28.8%  → CONVENTION
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

## License

MIT — Built by [Arian Gogani](https://github.com/arian-gogani)
