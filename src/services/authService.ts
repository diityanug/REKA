import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { deleteSetting, getSetting } from './database';

// Legacy SQLite keys (migrated automatically to SecureStore)
const LEGACY_LOCK_ENABLED = 'app_lock_enabled';
const LEGACY_PIN_HASH = 'app_lock_pin_hash';
const LEGACY_BIOMETRICS_ENABLED = 'app_lock_biometrics_enabled';
const LEGACY_PIN_SALT = 'reka_vault_salt_v1_';

// Hardware-backed SecureStore keys (alphanumeric, '.', '-', '_' only)
const SECURE_LOCK_ENABLED = 'reka.app_lock_enabled';
const SECURE_BIOMETRICS_ENABLED = 'reka.app_lock_biometrics_enabled';
const SECURE_PIN_RECORD = 'reka.pin_record_v2';
const SECURE_FAILED_ATTEMPTS = 'reka.pin_failed_attempts';
const SECURE_LOCKOUT_UNTIL = 'reka.pin_lockout_until';

const PIN_STRETCH_ROUNDS = 2500;
const PIN_DOMAIN_TAG = 'reka_vault_v2';
const MAX_FREE_ATTEMPTS = 5;

interface PinRecordV2 {
  salt: string;
  hash: string;
  rounds: number;
}

export interface LockoutState {
  failedAttempts: number;
  lockedUntilMs: number;
}

export interface PinVerificationResult {
  ok: boolean;
  isLockedOut: boolean;
  remainingSeconds: number;
  failedAttempts: number;
  lockedUntilMs: number;
}

async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(key, value);
    return true;
  } catch {
    return false;
  }
}

async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore missing/unsupported SecureStore cleanup
  }
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Self-contained SHA-256 helper used for synchronous key-stretching rounds and legacy v1 verification
function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let compositeAscii = ascii + '\x80';
  while (compositeAscii[lengthProperty] % 64 - 56) compositeAscii += '\x00';
  for (i = 0; i < compositeAscii[lengthProperty]; i++) {
    j = compositeAscii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] =
        i < 16
          ? w[i]
          : ((w[i - 16] + s0 + w[i - 7] + s1) | 0);

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const sigma0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const sigma1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);

      const t1 = (hash[7] + sigma1 + ch + k[i] + w[i]) | 0;
      const t2 = (sigma0 + maj) | 0;

      hash = [(t1 + t2) | 0, hash[0], hash[1], hash[2], (hash[3] + t1) | 0, hash[4], hash[5], hash[6]];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

async function deriveStretchedPinHash(pin: string, salt: string, rounds: number): Promise<string> {
  let acc = sha256(`${PIN_DOMAIN_TAG}:${salt}:${pin}`);
  for (let i = 1; i < rounds; i++) {
    acc = sha256(`${salt}:${acc}:${i}`);
  }
  try {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${PIN_DOMAIN_TAG}:final:${salt}:${acc}`
    );
  } catch {
    return sha256(`${PIN_DOMAIN_TAG}:final:${salt}:${acc}`);
  }
}

async function readPinRecord(): Promise<PinRecordV2 | null> {
  const raw = await secureGet(SECURE_PIN_RECORD);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PinRecordV2>;
    if (
      typeof parsed?.salt === 'string' &&
      parsed.salt.length > 0 &&
      typeof parsed?.hash === 'string' &&
      parsed.hash.length > 0 &&
      typeof parsed?.rounds === 'number' &&
      parsed.rounds > 0
    ) {
      return parsed as PinRecordV2;
    }
  } catch {
    // Corrupted record falls back to null
  }
  return null;
}

async function writePinV2(cleanPin: string): Promise<void> {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  const salt = bytesToHex(randomBytes);
  const hash = await deriveStretchedPinHash(cleanPin, salt, PIN_STRETCH_ROUNDS);
  const record: PinRecordV2 = { salt, hash, rounds: PIN_STRETCH_ROUNDS };
  const ok = await secureSet(SECURE_PIN_RECORD, JSON.stringify(record));
  if (!ok) {
    throw new Error('Secure device storage is unavailable.');
  }
}

async function cleanupLegacySqliteLockKeys(): Promise<void> {
  await Promise.all([
    deleteSetting(LEGACY_PIN_HASH).catch(() => {}),
    deleteSetting(LEGACY_LOCK_ENABLED).catch(() => {}),
    deleteSetting(LEGACY_BIOMETRICS_ENABLED).catch(() => {}),
  ]);
}

function getLockoutDurationMs(failedAttempts: number): number {
  if (failedAttempts < MAX_FREE_ATTEMPTS) return 0;
  if (failedAttempts === MAX_FREE_ATTEMPTS) return 30 * 1000;
  if (failedAttempts === MAX_FREE_ATTEMPTS + 1) return 60 * 1000;
  return 300 * 1000;
}

export async function getLockoutState(): Promise<LockoutState> {
  const [attemptsRaw, untilRaw] = await Promise.all([
    secureGet(SECURE_FAILED_ATTEMPTS),
    secureGet(SECURE_LOCKOUT_UNTIL),
  ]);
  const failedAttempts = Math.max(0, Number(attemptsRaw) || 0);
  const lockedUntilMs = Math.max(0, Number(untilRaw) || 0);
  return { failedAttempts, lockedUntilMs };
}

export async function resetPinLockout(): Promise<void> {
  await Promise.all([
    secureDelete(SECURE_FAILED_ATTEMPTS),
    secureDelete(SECURE_LOCKOUT_UNTIL),
  ]);
}

export async function clearAuthData(): Promise<void> {
  await Promise.all([
    secureDelete(SECURE_PIN_RECORD),
    secureDelete(SECURE_LOCK_ENABLED),
    secureDelete(SECURE_BIOMETRICS_ENABLED),
    resetPinLockout(),
    cleanupLegacySqliteLockKeys(),
  ]);
}

export type BiometricType = 'Face ID' | 'Fingerprint' | 'Biometrics' | 'None';

export interface BiometricCapabilities {
  hasHardware: boolean;
  isEnrolled: boolean;
  biometricType: BiometricType;
}

export interface LockSettings {
  isLockEnabled: boolean;
  isBiometricsEnabled: boolean;
  hasPin: boolean;
}

/**
 * Detect hardware and enrollment status for biometrics (Face ID / Touch ID / Biometrics).
 */
export async function checkBiometricCapabilities(): Promise<BiometricCapabilities> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { hasHardware: false, isEnrolled: false, biometricType: 'None' };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometricType: BiometricType = 'Biometrics';
    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = 'Face ID';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = 'Fingerprint';
    }

    return {
      hasHardware,
      isEnrolled,
      biometricType,
    };
  } catch {
    return { hasHardware: false, isEnrolled: false, biometricType: 'None' };
  }
}

/**
 * Read current lock settings from SecureStore (migrating seamlessly if only v1 SQLite keys exist).
 */
export async function getLockSettings(): Promise<LockSettings> {
  try {
    const [secureEnabled, secureBio, v2Record] = await Promise.all([
      secureGet(SECURE_LOCK_ENABLED),
      secureGet(SECURE_BIOMETRICS_ENABLED),
      readPinRecord(),
    ]);

    if (v2Record) {
      return {
        isLockEnabled: secureEnabled === 'true',
        isBiometricsEnabled: secureBio !== 'false',
        hasPin: true,
      };
    }

    const [legacyEnabled, legacyBio, legacyHash] = await Promise.all([
      getSetting(LEGACY_LOCK_ENABLED, 'false'),
      getSetting(LEGACY_BIOMETRICS_ENABLED, 'true'),
      getSetting(LEGACY_PIN_HASH, ''),
    ]);

    const hasLegacyPin = legacyHash.length > 0;
    const isEnabled = (secureEnabled !== null ? secureEnabled === 'true' : legacyEnabled === 'true') && hasLegacyPin;
    const isBioEnabled = secureBio !== null ? secureBio !== 'false' : legacyBio !== 'false';

    return {
      isLockEnabled: isEnabled,
      isBiometricsEnabled: isBioEnabled,
      hasPin: hasLegacyPin,
    };
  } catch {
    return {
      isLockEnabled: false,
      isBiometricsEnabled: true,
      hasPin: false,
    };
  }
}

/**
 * Set a new 4-digit PIN using cryptographic random salt and key stretching inside SecureStore.
 */
export async function setPin(pin: string): Promise<void> {
  const cleanPin = pin.trim();
  if (cleanPin.length < 4) {
    throw new Error('PIN must be at least 4 digits');
  }

  // Carry over existing v1 flags if upgrading via Change PIN
  const [secureEnabled, secureBio, legacyEnabled, legacyBio] = await Promise.all([
    secureGet(SECURE_LOCK_ENABLED),
    secureGet(SECURE_BIOMETRICS_ENABLED),
    getSetting(LEGACY_LOCK_ENABLED, ''),
    getSetting(LEGACY_BIOMETRICS_ENABLED, ''),
  ]);

  await writePinV2(cleanPin);
  if (secureEnabled === null && legacyEnabled) {
    await secureSet(SECURE_LOCK_ENABLED, legacyEnabled);
  }
  if (secureBio === null && legacyBio) {
    await secureSet(SECURE_BIOMETRICS_ENABLED, legacyBio);
  }
  await resetPinLockout();
  await cleanupLegacySqliteLockKeys();
}

/**
 * Verify entered PIN with brute-force lockout protection and transparent v1->v2 SecureStore migration.
 */
export async function verifyPinDetailed(enteredPin: string): Promise<PinVerificationResult> {
  const now = Date.now();
  const { failedAttempts, lockedUntilMs } = await getLockoutState();
  if (lockedUntilMs > now) {
    const remainingSeconds = Math.max(1, Math.ceil((lockedUntilMs - now) / 1000));
    return {
      ok: false,
      isLockedOut: true,
      remainingSeconds,
      failedAttempts,
      lockedUntilMs,
    };
  }

  const cleanPin = enteredPin.trim();
  let matched = false;

  try {
    const v2Record = await readPinRecord();
    if (v2Record) {
      const computed = await deriveStretchedPinHash(cleanPin, v2Record.salt, v2Record.rounds);
      matched = timingSafeEqual(computed, v2Record.hash);
    } else {
      const legacyHash = await getSetting(LEGACY_PIN_HASH, '');
      if (legacyHash) {
        const legacyComputed = sha256(LEGACY_PIN_SALT + cleanPin);
        matched = timingSafeEqual(legacyComputed, legacyHash);
        if (matched) {
          // Seamlessly upgrade legacy v1 PIN into SecureStore v2 and wipe plaintext SQLite hash
          const [legacyEnabled, legacyBio] = await Promise.all([
            getSetting(LEGACY_LOCK_ENABLED, 'false'),
            getSetting(LEGACY_BIOMETRICS_ENABLED, 'true'),
          ]);
          await writePinV2(cleanPin);
          await secureSet(SECURE_LOCK_ENABLED, legacyEnabled === 'true' ? 'true' : 'false');
          await secureSet(SECURE_BIOMETRICS_ENABLED, legacyBio !== 'false' ? 'true' : 'false');
          await cleanupLegacySqliteLockKeys();
        }
      }
    }
  } catch {
    matched = false;
  }

  if (matched) {
    await resetPinLockout();
    return {
      ok: true,
      isLockedOut: false,
      remainingSeconds: 0,
      failedAttempts: 0,
      lockedUntilMs: 0,
    };
  }

  const nextAttempts = failedAttempts + 1;
  const cooldownMs = getLockoutDurationMs(nextAttempts);
  const nextLockedUntil = cooldownMs > 0 ? Date.now() + cooldownMs : 0;

  await Promise.all([
    secureSet(SECURE_FAILED_ATTEMPTS, String(nextAttempts)),
    nextLockedUntil > 0
      ? secureSet(SECURE_LOCKOUT_UNTIL, String(nextLockedUntil))
      : secureDelete(SECURE_LOCKOUT_UNTIL),
  ]);

  return {
    ok: false,
    isLockedOut: cooldownMs > 0,
    remainingSeconds: cooldownMs > 0 ? Math.ceil(cooldownMs / 1000) : 0,
    failedAttempts: nextAttempts,
    lockedUntilMs: nextLockedUntil,
  };
}

/**
 * Verify whether an entered PIN matches the stored hash.
 */
export async function verifyPin(enteredPin: string): Promise<boolean> {
  const result = await verifyPinDetailed(enteredPin);
  return result.ok;
}

/**
 * Enable or disable app lock. Requires a PIN to already be set when enabling.
 */
export async function setLockEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    const v2Record = await readPinRecord();
    const legacyHash = v2Record ? '' : await getSetting(LEGACY_PIN_HASH, '');
    if (!v2Record && !legacyHash) {
      throw new Error('Please set a PIN before enabling App Lock.');
    }
  }
  await secureSet(SECURE_LOCK_ENABLED, enabled ? 'true' : 'false');
  await deleteSetting(LEGACY_LOCK_ENABLED).catch(() => {});
}

/**
 * Toggle biometric unlocking on/off.
 */
export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  await secureSet(SECURE_BIOMETRICS_ENABLED, enabled ? 'true' : 'false');
  await deleteSetting(LEGACY_BIOMETRICS_ENABLED).catch(() => {});
}

/**
 * Request OS-level biometric authentication.
 */
export async function authenticateWithBiometrics(promptMessage: string = 'Unlock Reka'): Promise<boolean> {
  try {
    const caps = await checkBiometricCapabilities();
    if (!caps.hasHardware || !caps.isEnrolled) {
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: true,
    });

    if (result.success) {
      await resetPinLockout();
    }

    return result.success;
  } catch {
    return false;
  }
}
