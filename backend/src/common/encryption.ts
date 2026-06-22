import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard IV length
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;

// Derive a 32-byte key from our STORAGE_ENCRYPTION_KEY env variable using PBKDF2
const getEncryptionKey = (salt: Buffer): Buffer => {
  const masterKey = process.env.STORAGE_ENCRYPTION_KEY || 'default-super-secret-master-key-must-change-in-prod';
  return crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha256');
};

/**
 * Encrypt a plain-text string using AES-256-GCM
 */
export const encrypt = (text: string): string => {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = getEncryptionKey(salt);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine salt, iv, tag, and encrypted content into a single string for storage
  return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
};

/**
 * Decrypt an AES-256-GCM encrypted hex string back to plain-text.
 * Falls back to returning the input string if not in hex or if decryption fails.
 */
export const decrypt = (cipherText: string): string => {
  if (!cipherText) return '';
  
  // Verify it looks like a hex string of appropriate length
  if (!/^[0-9a-fA-F]+$/.test(cipherText) || cipherText.length < (SALT_LENGTH + IV_LENGTH + TAG_LENGTH) * 2) {
    return cipherText; // Fallback to raw text if not hex-encoded
  }

  try {
    const buffer = Buffer.from(cipherText, 'hex');
    
    // Extract pieces
    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    const key = getEncryptionKey(salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch (err: any) {
    console.error('Decryption failed. Falling back to original cipherText.', err.message);
    return cipherText; // Fallback to raw text if key mismatched or corrupted
  }
};
