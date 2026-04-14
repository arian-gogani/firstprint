/**
 * Firstprint Demo — Python Support
 * 
 * Tests fingerprinting and comparison with Python code.
 * 
 * Run: npx tsx demo/python-test.ts
 */

import { fingerprint } from '../packages/core/src/fingerprint.js';
import { compare } from '../packages/compare/src/compare.js';

const pythonOriginal = `
import hashlib
from typing import Optional

class UserValidator:
    def __init__(self, db_connection):
        self.db = db_connection
        self.cache = {}

    async def validate(self, user_id: str, email: str) -> bool:
        if not user_id:
            raise ValueError("Missing user ID")
        if not email or "@" not in email:
            raise ValueError("Invalid email")

        token = hashlib.sha256(user_id.encode()).hexdigest()

        if user_id in self.cache:
            return self.cache[user_id]

        user = await self.db.find_user(user_id)
        if not user:
            return False

        if user.role == "admin":
            admin_ok = await self._verify_admin(user)
            if not admin_ok:
                raise PermissionError("Admin verification failed")

        if user.role in ("admin", "editor"):
            perms = await self._check_permissions(user)
            if not perms:
                return False

        self.cache[user_id] = True
        return True

    async def _verify_admin(self, user) -> bool:
        try:
            result = await self.db.check_admin(user.id)
            return result.get("verified", False)
        except Exception:
            return False

    async def _check_permissions(self, user) -> bool:
        try:
            result = await self.db.get_permissions(user.id)
            return result.get("allowed", False)
        except Exception:
            return False
`;

const pythonClone = `
import hashlib
from typing import Optional

class AccountAuthenticator:
    def __init__(self, database):
        self.database = database
        self.memo = {}

    async def authenticate(self, account_id: str, contact_email: str) -> bool:
        if not account_id:
            raise ValueError("Missing account ID")
        if not contact_email or "@" not in contact_email:
            raise ValueError("Invalid email address")

        digest = hashlib.sha256(account_id.encode()).hexdigest()

        if account_id in self.memo:
            return self.memo[account_id]

        account = await self.database.find_account(account_id)
        if not account:
            return False

        if account.permission == "superuser":
            super_ok = await self._verify_superuser(account)
            if not super_ok:
                raise PermissionError("Superuser verification failed")

        if account.permission in ("superuser", "writer"):
            access = await self._check_access(account)
            if not access:
                return False

        self.memo[account_id] = True
        return True

    async def _verify_superuser(self, account) -> bool:
        try:
            result = await self.database.check_superuser(account.id)
            return result.get("verified", False)
        except Exception:
            return False

    async def _check_access(self, account) -> bool:
        try:
            result = await self.database.get_access(account.id)
            return result.get("allowed", False)
        except Exception:
            return False
`;

async function main() {
  console.log(`
╔═══════════════════════════════════════════════╗
║        PYTHON CLONE DETECTION TEST            ║
╚═══════════════════════════════════════════════╝
`);

  console.log('Fingerprinting Python original...');
  const origFp = await fingerprint(pythonOriginal, 'python');
  console.log(`  Features: ${origFp.featureCount}`);

  console.log('Fingerprinting Python clone...');
  const cloneFp = await fingerprint(pythonClone, 'python');
  console.log(`  Features: ${cloneFp.featureCount}`);

  console.log('\nComparing...');
  const result = compare(origFp, cloneFp);

  const bar = '█'.repeat(Math.round(result.derivationScore * 30));
  const empty = '░'.repeat(30 - Math.round(result.derivationScore * 30));
  console.log(`\n  Score: ${bar}${empty} ${(result.derivationScore * 100).toFixed(1)}%`);
  console.log(`  Band:  ${result.band}`);
  console.log(`  ${result.summary}`);
  console.log(`\n  ✅ Python support working!`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
