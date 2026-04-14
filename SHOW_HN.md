# Show HN: Firstprint — Structural fingerprinting to detect AI-generated code clones

I built a system that converts source code into structural fingerprints and detects clones even when every variable, function, and type name has been changed.

**The problem:** AI makes it trivial to clone code. Paste a URL, say "build me this," and you get a working replica in minutes. There's no infrastructure to prove you built something first, detect when your work is structurally reproduced, or generate evidence of derivation.

**What Firstprint does:**

1. Parses code into an AST using tree-sitter
2. Normalizes it — strips all variable names, function names, string literals, comments
3. Extracts structural features: AST subtree patterns, control flow graphs, dependency relationships, logic patterns (guard clauses, conditional chains, error handling)
4. Hashes features using MinHash (128-dim Jaccard estimator) and SimHash (64-bit cosine similarity)
5. Compares fingerprints with rarity-weighted scoring — common patterns get low weight, rare structural decisions get high weight
6. Signs and timestamps fingerprints in an Ed25519 Merkle-chained provenance ledger

**The key insight:** Similarity alone is meaningless. What matters is the improbability of co-occurrence. Two apps both having a login page means nothing. Two apps sharing a 9-step onboarding flow with identical branching logic at step 6 is statistically suspicious.

**Results from the test suite (55/55 passing):**

- Exact clone (all names changed): **100%** — correctly detected
- Refactored clone (functions inlined): **50.7%** — flagged as suspicious
- Partial clone (~50% copied): **47.1%** — detected shared structure
- Independent implementation (same problem, different approach): **37.3%** — low score
- Unrelated code: **28.8%** — classified as convention

Score ordering is monotonic: exact > refactored > partial > independent > unrelated. ✅

**Function-level detection:** Firstprint can also fingerprint individual functions, identifying exactly which ones were copied. In a test with a partial clone, it correctly identified 5 of 6 original functions as having structural matches, with the main validation function scoring 100%.

**The provenance ledger:** Every fingerprint gets an Ed25519 signature, Merkle root, and chain link. Tamper detection is built in — modify any field and verification fails.

**Tech:** TypeScript monorepo, tree-sitter for parsing, MinHash/SimHash for similarity-preserving hashing, @noble/ed25519 for signatures. Supports TypeScript and Python. ~4,400 lines of code.

**What's next:** Rarity corpus from GitHub (so the scoring can distinguish common vs rare patterns with real data), generation-layer integration with AI platforms, and expansion to more languages/modalities.

The long-term vision: Firstprint becomes the provenance protocol for everything AI creates — the birth certificate that gives every AI-generated artifact a structural identity, computes what's original about it, and enforces attribution when that originality is reproduced.

GitHub: https://github.com/arian-gogani/firstprint

Try it: `git clone https://github.com/arian-gogani/firstprint && cd firstprint && npm install && npx tsx demo/detect-clone.ts`
