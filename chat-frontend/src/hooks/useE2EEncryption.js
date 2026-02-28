import { useState, useEffect, useCallback, useRef } from 'react';
import {
    generateKeyPair,
    importPrivateKey,
    importPublicKey,
    generateSymmetricKey,
    encryptMessage,
    decryptMessage,
    encryptSymmetricKey,
    decryptSymmetricKey,
    exportSymmetricKey,
    encryptPrivateKeyWithPassword,
    decryptPrivateKeyWithPassword,
    storeEncryptedPrivateKey,
    getStoredEncryptedPrivateKey,
    storePublicKey,
    getStoredPublicKey,
    clearE2EKeys,
} from '../utils/encryption';

const API_BASE_URL = 'http://localhost:6969';

export function useE2EEncryption(sessionToken, username) {
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState(null);
    const privateKeyRef = useRef(null);
    const publicKeyRef = useRef(null);
    const publicKeyCacheRef = useRef(new Map());

    // Initialize E2E encryption - generate or load keys
    const initialize = useCallback(async (password) => {
        if (!sessionToken || !username || !password) {
            return false;
        }

        try {
            setError(null);

            // Check if we have stored keys
            const storedPrivateKey = getStoredEncryptedPrivateKey();
            const storedPublicKey = getStoredPublicKey();

            if (storedPrivateKey && storedPublicKey) {
                // Decrypt stored private key
                try {
                    const privateKeyBase64 = await decryptPrivateKeyWithPassword(
                        storedPrivateKey.encrypted,
                        storedPrivateKey.salt,
                        storedPrivateKey.iv,
                        password
                    );
                    privateKeyRef.current = await importPrivateKey(privateKeyBase64);
                    publicKeyRef.current = storedPublicKey;
                    setIsInitialized(true);
                    return true;
                } catch (e) {
                    // Wrong password or corrupted keys
                    setError('Failed to decrypt keys. Wrong password?');
                    return false;
                }
            }

            // Generate new key pair
            const { publicKey, privateKey } = await generateKeyPair();

            // Encrypt private key with password
            const encryptedPrivateKey = await encryptPrivateKeyWithPassword(privateKey, password);

            // Store encrypted private key locally
            storeEncryptedPrivateKey(encryptedPrivateKey);
            storePublicKey(publicKey);

            // Upload public key to server
            const response = await fetch(`${API_BASE_URL}/users/me/public-key`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${sessionToken}`,
                },
                body: JSON.stringify({ publicKey }),
            });

            if (!response.ok) {
                throw new Error('Failed to upload public key');
            }

            privateKeyRef.current = await importPrivateKey(privateKey);
            publicKeyRef.current = publicKey;
            setIsInitialized(true);
            return true;
        } catch (e) {
            console.error('E2E initialization error:', e);
            setError(e.message);
            return false;
        }
    }, [sessionToken, username]);

    // Get public key for a user
    const getPublicKey = useCallback(async (targetUsername) => {
        if (!sessionToken) return null;

        // Check cache
        if (publicKeyCacheRef.current.has(targetUsername)) {
            return publicKeyCacheRef.current.get(targetUsername);
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/users/${encodeURIComponent(targetUsername)}/public-key`,
                {
                    headers: { Authorization: `Bearer ${sessionToken}` },
                }
            );

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            const publicKey = await importPublicKey(data.publicKey);
            publicKeyCacheRef.current.set(targetUsername, publicKey);
            return publicKey;
        } catch (e) {
            console.error('Failed to get public key:', e);
            return null;
        }
    }, [sessionToken]);

    // Encrypt a message for a DM
    const encryptForDM = useCallback(async (text, recipientUsername) => {
        if (!isInitialized || !privateKeyRef.current) {
            return { text, isEncrypted: false };
        }

        try {
            const recipientPublicKey = await getPublicKey(recipientUsername);
            if (!recipientPublicKey) {
                // Recipient doesn't have E2E setup, send unencrypted
                return { text, isEncrypted: false };
            }

            // Get sender's public key
            const senderPublicKey = await importPublicKey(publicKeyRef.current);

            // Generate a symmetric key for this message
            const symmetricKey = await generateSymmetricKey();

            // Encrypt the message
            const { ciphertext, iv } = await encryptMessage(text, symmetricKey);

            // Encrypt the symmetric key for both sender and recipient
            const encryptedKeys = {};
            encryptedKeys[username] = await encryptSymmetricKey(symmetricKey, senderPublicKey);
            encryptedKeys[recipientUsername] = await encryptSymmetricKey(symmetricKey, recipientPublicKey);

            return {
                text: ciphertext,
                iv,
                encryptedKeys,
                isEncrypted: true,
            };
        } catch (e) {
            console.error('Encryption error:', e);
            return { text, isEncrypted: false };
        }
    }, [isInitialized, username, getPublicKey]);

    // Decrypt a message
    const decryptMessageContent = useCallback(async (encryptedText, iv, encryptedKeys) => {
        if (!isInitialized || !privateKeyRef.current) {
            return '[Encrypted message - E2E not initialized]';
        }

        try {
            // Get our encrypted symmetric key
            const myEncryptedKey = encryptedKeys?.[username];
            if (!myEncryptedKey) {
                return '[Encrypted message - no key for you]';
            }

            // Decrypt the symmetric key
            const symmetricKey = await decryptSymmetricKey(myEncryptedKey, privateKeyRef.current);

            // Decrypt the message
            const plaintext = await decryptMessage(encryptedText, iv, symmetricKey);
            return plaintext;
        } catch (e) {
            console.error('Decryption error:', e);
            return '[Failed to decrypt message]';
        }
    }, [isInitialized, username]);

    // Clear encryption state on logout
    const cleanup = useCallback(() => {
        privateKeyRef.current = null;
        publicKeyRef.current = null;
        publicKeyCacheRef.current.clear();
        setIsInitialized(false);
        clearE2EKeys();
    }, []);

    return {
        isInitialized,
        error,
        initialize,
        encryptForDM,
        decryptMessage: decryptMessageContent,
        cleanup,
        hasStoredKeys: !!getStoredEncryptedPrivateKey(),
    };
}

export default useE2EEncryption;
