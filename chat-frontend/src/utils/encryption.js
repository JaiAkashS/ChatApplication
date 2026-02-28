/**
 * End-to-End Encryption Utilities
 * Uses Web Crypto API for secure client-side encryption
 */

const ALGORITHM = {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
};

const AES_ALGORITHM = {
    name: 'AES-GCM',
    length: 256,
};

/**
 * Generate a new RSA key pair for a user
 * @returns {Promise<{publicKey: string, privateKey: string}>}
 */
export const generateKeyPair = async () => {
    const keyPair = await crypto.subtle.generateKey(
        ALGORITHM,
        true, // extractable
        ['encrypt', 'decrypt']
    );

    const publicKeyExported = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKeyExported = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
        publicKey: arrayBufferToBase64(publicKeyExported),
        privateKey: arrayBufferToBase64(privateKeyExported),
    };
};

/**
 * Import a public key from base64 string
 * @param {string} publicKeyBase64 
 * @returns {Promise<CryptoKey>}
 */
export const importPublicKey = async (publicKeyBase64) => {
    const keyData = base64ToArrayBuffer(publicKeyBase64);
    return crypto.subtle.importKey(
        'spki',
        keyData,
        ALGORITHM,
        true,
        ['encrypt']
    );
};

/**
 * Import a private key from base64 string
 * @param {string} privateKeyBase64 
 * @returns {Promise<CryptoKey>}
 */
export const importPrivateKey = async (privateKeyBase64) => {
    const keyData = base64ToArrayBuffer(privateKeyBase64);
    return crypto.subtle.importKey(
        'pkcs8',
        keyData,
        ALGORITHM,
        true,
        ['decrypt']
    );
};

/**
 * Generate a random AES key for symmetric encryption
 * @returns {Promise<CryptoKey>}
 */
export const generateSymmetricKey = async () => {
    return crypto.subtle.generateKey(
        AES_ALGORITHM,
        true,
        ['encrypt', 'decrypt']
    );
};

/**
 * Export symmetric key to raw bytes
 * @param {CryptoKey} key 
 * @returns {Promise<string>}
 */
export const exportSymmetricKey = async (key) => {
    const exported = await crypto.subtle.exportKey('raw', key);
    return arrayBufferToBase64(exported);
};

/**
 * Import symmetric key from base64
 * @param {string} keyBase64 
 * @returns {Promise<CryptoKey>}
 */
export const importSymmetricKey = async (keyBase64) => {
    const keyData = base64ToArrayBuffer(keyBase64);
    return crypto.subtle.importKey(
        'raw',
        keyData,
        AES_ALGORITHM,
        true,
        ['encrypt', 'decrypt']
    );
};

/**
 * Encrypt a message using AES-GCM (for actual message content)
 * @param {string} plaintext 
 * @param {CryptoKey} symmetricKey 
 * @returns {Promise<{ciphertext: string, iv: string}>}
 */
export const encryptMessage = async (plaintext, symmetricKey) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        symmetricKey,
        data
    );

    return {
        ciphertext: arrayBufferToBase64(ciphertext),
        iv: arrayBufferToBase64(iv),
    };
};

/**
 * Decrypt a message using AES-GCM
 * @param {string} ciphertextBase64 
 * @param {string} ivBase64 
 * @param {CryptoKey} symmetricKey 
 * @returns {Promise<string>}
 */
export const decryptMessage = async (ciphertextBase64, ivBase64, symmetricKey) => {
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);
    const iv = base64ToArrayBuffer(ivBase64);

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        symmetricKey,
        ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
};

/**
 * Encrypt a symmetric key using RSA public key
 * @param {CryptoKey} symmetricKey 
 * @param {CryptoKey} publicKey 
 * @returns {Promise<string>}
 */
export const encryptSymmetricKey = async (symmetricKey, publicKey) => {
    const rawKey = await crypto.subtle.exportKey('raw', symmetricKey);
    const encrypted = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKey,
        rawKey
    );
    return arrayBufferToBase64(encrypted);
};

/**
 * Decrypt a symmetric key using RSA private key
 * @param {string} encryptedKeyBase64 
 * @param {CryptoKey} privateKey 
 * @returns {Promise<CryptoKey>}
 */
export const decryptSymmetricKey = async (encryptedKeyBase64, privateKey) => {
    const encryptedKey = base64ToArrayBuffer(encryptedKeyBase64);
    const rawKey = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        privateKey,
        encryptedKey
    );
    return crypto.subtle.importKey(
        'raw',
        rawKey,
        AES_ALGORITHM,
        true,
        ['encrypt', 'decrypt']
    );
};

/**
 * Encrypt private key with password for secure local storage
 * @param {string} privateKeyBase64 
 * @param {string} password 
 * @returns {Promise<{encrypted: string, salt: string, iv: string}>}
 */
export const encryptPrivateKeyWithPassword = async (privateKeyBase64, password) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive key from password
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        passwordKey,
        AES_ALGORITHM,
        false,
        ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        derivedKey,
        encoder.encode(privateKeyBase64)
    );

    return {
        encrypted: arrayBufferToBase64(encrypted),
        salt: arrayBufferToBase64(salt),
        iv: arrayBufferToBase64(iv),
    };
};

/**
 * Decrypt private key with password
 * @param {string} encryptedBase64 
 * @param {string} saltBase64 
 * @param {string} ivBase64 
 * @param {string} password 
 * @returns {Promise<string>}
 */
export const decryptPrivateKeyWithPassword = async (encryptedBase64, saltBase64, ivBase64, password) => {
    const encrypted = base64ToArrayBuffer(encryptedBase64);
    const salt = base64ToArrayBuffer(saltBase64);
    const iv = base64ToArrayBuffer(ivBase64);

    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        passwordKey,
        AES_ALGORITHM,
        false,
        ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        derivedKey,
        encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
};

// Utility functions
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// Storage keys
const PRIVATE_KEY_STORAGE_KEY = 'chat.e2e.privateKey';
const PUBLIC_KEY_STORAGE_KEY = 'chat.e2e.publicKey';

/**
 * Store encrypted private key locally
 */
export const storeEncryptedPrivateKey = (encryptedData) => {
    localStorage.setItem(PRIVATE_KEY_STORAGE_KEY, JSON.stringify(encryptedData));
};

/**
 * Get stored encrypted private key
 */
export const getStoredEncryptedPrivateKey = () => {
    const data = localStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
};

/**
 * Store public key locally (for reference)
 */
export const storePublicKey = (publicKey) => {
    localStorage.setItem(PUBLIC_KEY_STORAGE_KEY, publicKey);
};

/**
 * Get stored public key
 */
export const getStoredPublicKey = () => {
    return localStorage.getItem(PUBLIC_KEY_STORAGE_KEY);
};

/**
 * Clear all E2E keys from storage
 */
export const clearE2EKeys = () => {
    localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
    localStorage.removeItem(PUBLIC_KEY_STORAGE_KEY);
};

export default {
    generateKeyPair,
    importPublicKey,
    importPrivateKey,
    generateSymmetricKey,
    exportSymmetricKey,
    importSymmetricKey,
    encryptMessage,
    decryptMessage,
    encryptSymmetricKey,
    decryptSymmetricKey,
    encryptPrivateKeyWithPassword,
    decryptPrivateKeyWithPassword,
    storeEncryptedPrivateKey,
    getStoredEncryptedPrivateKey,
    storePublicKey,
    getStoredPublicKey,
    clearE2EKeys,
};
