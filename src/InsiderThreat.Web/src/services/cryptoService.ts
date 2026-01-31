// cryptoService.ts

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export const cryptoService = {
    // Generate RSA-OAEP Key Pair
    generateKeyPair: async (): Promise<CryptoKeyPair> => {
        return window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256"
            },
            true,
            ["encrypt", "decrypt"]
        );
    },

    // Export Key to Base64 (spki for public, pkcs8 for private)
    exportKey: async (key: CryptoKey): Promise<string> => {
        const format = key.type === 'public' ? 'spki' : 'pkcs8';
        const exported = await window.crypto.subtle.exportKey(format, key);
        return arrayBufferToBase64(exported);
    },

    // Import Key from Base64
    importKey: async (base64Key: string, type: 'public' | 'private'): Promise<CryptoKey> => {
        const format = type === 'public' ? 'spki' : 'pkcs8';
        const keyData = base64ToArrayBuffer(base64Key);
        return window.crypto.subtle.importKey(
            format,
            keyData,
            {
                name: "RSA-OAEP",
                hash: "SHA-256"
            },
            true,
            [type === 'public' ? 'encrypt' : 'decrypt']
        );
    },

    // Encrypt message with Public Key
    encrypt: async (message: string, publicKey: CryptoKey): Promise<string> => {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: "RSA-OAEP"
            },
            publicKey,
            data
        );
        return arrayBufferToBase64(encrypted);
    },

    // Decrypt message with Private Key
    decrypt: async (encryptedMessageBase64: string, privateKey: CryptoKey): Promise<string> => {
        try {
            const data = base64ToArrayBuffer(encryptedMessageBase64);
            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: "RSA-OAEP"
                },
                privateKey,
                data
            );
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (e) {
            console.error("Decryption failed", e);
            return "[Encrypted Message]";
        }
    },

    // Store keys in localStorage (MVP only - usage: 'privateKey', 'publicKey')
    saveKeys: (publicKey: string, privateKey: string) => {
        localStorage.setItem('chat_public_key', publicKey);
        localStorage.setItem('chat_private_key', privateKey);
    },

    loadKeys: () => {
        return {
            publicKey: localStorage.getItem('chat_public_key'),
            privateKey: localStorage.getItem('chat_private_key')
        };
    }
};
