/**
 * Test Fixtures — Code samples at varying similarity levels.
 * 
 * These test the scoring system's ability to distinguish:
 * 1. Exact structural clones (renamed variables)
 * 2. Partial clones (some functions copied, others new)
 * 3. Structural refactors (inlined functions, extracted methods)
 * 4. Independent implementations (same problem, different approach)
 * 5. Completely unrelated code
 */

// ─── ORIGINAL: A user authentication module ────────────────────────────────

export const ORIGINAL = `
import { createHash } from 'crypto';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  active: boolean;
}

async function validateUser(user: User): Promise<boolean> {
  if (!user.id) throw new Error('Missing ID');
  if (!user.email) throw new Error('Missing email');
  if (!user.email.includes('@')) throw new Error('Invalid email format');

  const token = createHash('sha256').update(user.id + user.email).digest('hex');

  if (user.role === 'admin') {
    const adminCheck = await verifyAdminAccess(user);
    if (!adminCheck) throw new Error('Admin verification failed');
  }

  if (user.role === 'admin' || user.role === 'editor') {
    const hasPermission = await checkPermissions(user);
    if (!hasPermission) return false;
  }

  await logAccess(user, token);
  return true;
}

async function verifyAdminAccess(user: User): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/' + user.id);
    if (!res.ok) return false;
    const data = await res.json();
    return data.verified === true;
  } catch {
    return false;
  }
}

async function checkPermissions(user: User): Promise<boolean> {
  try {
    const res = await fetch('/api/perms/' + user.id);
    if (!res.ok) return false;
    const data = await res.json();
    return data.allowed === true;
  } catch {
    return false;
  }
}

async function logAccess(user: User, token: string): Promise<void> {
  console.log('Access:', user.id, token.slice(0, 8));
}

function hashUser(user: User): string {
  return createHash('md5').update(JSON.stringify(user)).digest('hex');
}

export function getRoleLevel(role: User['role']): number {
  switch (role) {
    case 'admin': return 3;
    case 'editor': return 2;
    case 'viewer': return 1;
    default: return 0;
  }
}
`;


// ─── CLONE 1: Exact structural clone (renamed everything) ──────────────────
// Expected: 90-100% derivation score, HIGH_CONFIDENCE_CLONE

export const EXACT_CLONE = `
import { createHash } from 'crypto';

interface Account {
  id: string;
  displayName: string;
  contactEmail: string;
  permission: 'superuser' | 'writer' | 'reader';
  enabled: boolean;
}

async function authenticateAccount(account: Account): Promise<boolean> {
  if (!account.id) throw new Error('Missing ID');
  if (!account.contactEmail) throw new Error('Missing email');
  if (!account.contactEmail.includes('@')) throw new Error('Invalid email format');

  const digest = createHash('sha256').update(account.id + account.contactEmail).digest('hex');

  if (account.permission === 'superuser') {
    const superCheck = await verifySuperAccess(account);
    if (!superCheck) throw new Error('Super verification failed');
  }

  if (account.permission === 'superuser' || account.permission === 'writer') {
    const canAccess = await checkAccess(account);
    if (!canAccess) return false;
  }

  await recordEntry(account, digest);
  return true;
}

async function verifySuperAccess(account: Account): Promise<boolean> {
  try {
    const res = await fetch('/api/super/' + account.id);
    if (!res.ok) return false;
    const data = await res.json();
    return data.verified === true;
  } catch {
    return false;
  }
}

async function checkAccess(account: Account): Promise<boolean> {
  try {
    const res = await fetch('/api/access/' + account.id);
    if (!res.ok) return false;
    const data = await res.json();
    return data.allowed === true;
  } catch {
    return false;
  }
}

async function recordEntry(account: Account, digest: string): Promise<void> {
  console.log('Entry:', account.id, digest.slice(0, 8));
}

function hashAccount(account: Account): string {
  return createHash('md5').update(JSON.stringify(account)).digest('hex');
}

export function getPermLevel(perm: Account['permission']): number {
  switch (perm) {
    case 'superuser': return 3;
    case 'writer': return 2;
    case 'reader': return 1;
    default: return 0;
  }
}
`;

// ─── CLONE 2: Partial clone (~50% copied, ~50% new) ───────────────────────
// Expected: 40-60% derivation score, SUSPICIOUS

export const PARTIAL_CLONE = `
import { createHash } from 'crypto';
import { Redis } from 'ioredis';

interface Member {
  id: string;
  name: string;
  email: string;
  tier: 'gold' | 'silver' | 'bronze';
  active: boolean;
}

// This function is structurally identical to the original validateUser
async function validateMember(member: Member): Promise<boolean> {
  if (!member.id) throw new Error('Missing ID');
  if (!member.email) throw new Error('Missing email');
  if (!member.email.includes('@')) throw new Error('Invalid email format');

  const token = createHash('sha256').update(member.id + member.email).digest('hex');

  if (member.tier === 'gold') {
    const goldCheck = await verifyGoldStatus(member);
    if (!goldCheck) throw new Error('Gold verification failed');
  }

  if (member.tier === 'gold' || member.tier === 'silver') {
    const hasBenefits = await checkBenefits(member);
    if (!hasBenefits) return false;
  }

  await logMemberAccess(member, token);
  return true;
}

// These are NEW functions not in the original
async function verifyGoldStatus(member: Member): Promise<boolean> {
  const redis = new Redis();
  const cached = await redis.get('gold:' + member.id);
  if (cached) return cached === 'true';
  
  const res = await fetch('/api/gold/' + member.id);
  const data = await res.json();
  await redis.setex('gold:' + member.id, 3600, String(data.verified));
  return data.verified === true;
}

async function checkBenefits(member: Member): Promise<boolean> {
  const redis = new Redis();
  const cached = await redis.get('benefits:' + member.id);
  if (cached) return cached === 'true';
  
  const res = await fetch('/api/benefits/' + member.id);
  const data = await res.json();
  await redis.setex('benefits:' + member.id, 3600, String(data.active));
  return data.active === true;
}

async function logMemberAccess(member: Member, token: string): Promise<void> {
  const redis = new Redis();
  await redis.lpush('access_log', JSON.stringify({
    memberId: member.id,
    token: token.slice(0, 8),
    timestamp: Date.now(),
  }));
}

// Completely new feature not in original
async function getMemberAnalytics(memberId: string): Promise<object> {
  const redis = new Redis();
  const logs = await redis.lrange('access_log', 0, -1);
  const memberLogs = logs
    .map(l => JSON.parse(l))
    .filter(l => l.memberId === memberId);
  
  return {
    totalAccesses: memberLogs.length,
    lastAccess: memberLogs[0]?.timestamp,
    uniqueTokens: new Set(memberLogs.map(l => l.token)).size,
  };
}
`;

// ─── INDEPENDENT: Same problem, completely different approach ──────────────
// Expected: 10-30% derivation score, CONVENTION or INFLUENCE

export const INDEPENDENT_IMPL = `
import { verify } from 'jsonwebtoken';

type Role = 'ADMIN' | 'MOD' | 'USER';

class AuthService {
  private jwtSecret: string;
  
  constructor(secret: string) {
    this.jwtSecret = secret;
  }

  async authenticate(token: string): Promise<{ userId: string; role: Role }> {
    const decoded = verify(token, this.jwtSecret) as { sub: string; role: Role };
    
    const user = await this.findUser(decoded.sub);
    if (!user) throw new Error('User not found');
    
    if (user.banned) throw new Error('Account suspended');
    
    return { userId: user.id, role: decoded.role };
  }
  
  private async findUser(id: string) {
    const response = await fetch('/users/' + id);
    return response.ok ? response.json() : null;
  }
  
  async authorize(userId: string, requiredRole: Role): Promise<boolean> {
    const roleHierarchy: Record<Role, number> = {
      ADMIN: 3,
      MOD: 2,
      USER: 1,
    };
    
    const user = await this.findUser(userId);
    if (!user) return false;
    
    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  }
}
`;


// ─── UNRELATED: Completely different code ──────────────────────────────────
// Expected: 0-15% derivation score, CONVENTION

export const UNRELATED = `
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface Config {
  port: number;
  host: string;
  debug: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

function loadConfig(path: string): Config {
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw);
  
  return {
    port: parsed.port ?? 3000,
    host: parsed.host ?? 'localhost',
    debug: parsed.debug ?? false,
    logLevel: parsed.logLevel ?? 'info',
  };
}

function saveConfig(config: Config, path: string): void {
  writeFileSync(path, JSON.stringify(config, null, 2));
}

function mergeConfigs(base: Config, override: Partial<Config>): Config {
  return { ...base, ...override };
}

class Logger {
  private level: Config['logLevel'];
  
  constructor(level: Config['logLevel']) {
    this.level = level;
  }
  
  private shouldLog(msgLevel: Config['logLevel']): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    return levels.indexOf(msgLevel) <= levels.indexOf(this.level);
  }
  
  error(msg: string) { if (this.shouldLog('error')) console.error(msg); }
  warn(msg: string) { if (this.shouldLog('warn')) console.warn(msg); }
  info(msg: string) { if (this.shouldLog('info')) console.info(msg); }
  debug(msg: string) { if (this.shouldLog('debug')) console.debug(msg); }
}
`;

// ─── REFACTORED CLONE: Same logic, restructured ───────────────────────────
// Expected: 50-75% derivation score, SUSPICIOUS
// Tests if the system catches structural refactoring

export const REFACTORED_CLONE = `
import { createHash } from 'crypto';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  active: boolean;
}

// Guard clauses inlined into a single function (no helper functions)
async function validateProfile(profile: Profile): Promise<boolean> {
  if (!profile.id || !profile.email || !profile.email.includes('@')) {
    throw new Error('Invalid profile data');
  }

  const token = createHash('sha256').update(profile.id + profile.email).digest('hex');

  // Inlined admin check (was separate function in original)
  if (profile.role === 'admin') {
    try {
      const res = await fetch('/api/admin/' + profile.id);
      if (!res.ok || !(await res.json()).verified) {
        throw new Error('Admin verification failed');
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'Admin verification failed') throw e;
      throw new Error('Admin verification failed');
    }
  }

  // Inlined permission check (was separate function in original)
  if (profile.role !== 'viewer') {
    try {
      const res = await fetch('/api/perms/' + profile.id);
      if (!res.ok || !(await res.json()).allowed) return false;
    } catch {
      return false;
    }
  }

  console.log('Access:', profile.id, token.slice(0, 8));
  return true;
}

// Same role level logic, implemented as object instead of switch
const ROLE_LEVELS: Record<string, number> = {
  admin: 3,
  editor: 2,
  viewer: 1,
};

export function getLevel(role: string): number {
  return ROLE_LEVELS[role] ?? 0;
}
`;
