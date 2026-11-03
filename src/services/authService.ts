import * as LocalAuthentication from 'expo-local-authentication';
import { getSetting, setSetting } from './database';

const SETTING_LOCK_ENABLED = 'app_lock_enabled';
const SETTING_PIN_HASH = 'app_lock_pin_hash';
const SETTING_BIOMETRICS_ENABLED = 'app_lock_biometrics_enabled';

// Salt to prevent rainbow table attacks on 4-6 digit numeric PINs
const PIN_SALT = 'reka_vault_salt_v1_';

// Self-contained standard SHA-256 implementation (safe across all React Native / Hermes runtimes)
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
 * Read the current lock settings from SQLite.
 */
export async function getLockSettings(): Promise<LockSettings> {
  try {
    const [enabledStr, bioStr, hash] = await Promise.all([
      getSetting(SETTING_LOCK_ENABLED, 'false'),
      getSetting(SETTING_BIOMETRICS_ENABLED, 'true'),
      getSetting(SETTING_PIN_HASH, ''),
    ]);

    return {
      isLockEnabled: enabledStr === 'true' && hash.length > 0,
      isBiometricsEnabled: bioStr !== 'false',
      hasPin: hash.length > 0,
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
 * Set a new 4-digit PIN for the application.
 */
export async function setPin(pin: string): Promise<void> {
  const cleanPin = pin.trim();
  if (cleanPin.length < 4) {
    throw new Error('PIN must be at least 4 digits');
  }
  const hash = sha256(PIN_SALT + cleanPin);
  await setSetting(SETTING_PIN_HASH, hash);
}

/**
 * Verify whether an entered PIN matches the stored hash.
 */
export async function verifyPin(enteredPin: string): Promise<boolean> {
  try {
    const storedHash = await getSetting(SETTING_PIN_HASH, '');
    if (!storedHash) return false;
    const computedHash = sha256(PIN_SALT + enteredPin.trim());
    return computedHash === storedHash;
  } catch {
    return false;
  }
}

/**
 * Enable or disable app lock. Requires a PIN to already be set when enabling.
 */
export async function setLockEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    const storedHash = await getSetting(SETTING_PIN_HASH, '');
    if (!storedHash) {
      throw new Error('Please set a PIN before enabling App Lock.');
    }
  }
  await setSetting(SETTING_LOCK_ENABLED, enabled ? 'true' : 'false');
}

/**
 * Toggle biometric unlocking on/off.
 */
export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  await setSetting(SETTING_BIOMETRICS_ENABLED, enabled ? 'true' : 'false');
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

    return result.success;
  } catch {
    return false;
  }
}
