import crypto from 'crypto';

/**
 * Decrypts the incoming request from WhatsApp Flows
 * @param {string} encryptedAesKey - Base64 encoded encrypted AES key
 * @param {string} initialVector - Base64 encoded IV
 * @param {string} encryptedFlowData - Base64 encoded flow data
 * @param {string} privateKeyPem - PEM encoded RSA Private Key
 * @returns {object} Decrypted JSON object
 */
export const decryptRequest = (encryptedAesKey, initialVector, encryptedFlowData, privateKeyPem) => {
    try {
        // 1. Decrypt AES Key using Private RSA Key
        const privateKey = crypto.createPrivateKey(privateKeyPem);
        const decryptedAesKey = crypto.privateDecrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            Buffer.from(encryptedAesKey, 'base64')
        );

        // 2. Decrypt Flow Data using AES-128-GCM
        const flowDataBuffer = Buffer.from(encryptedFlowData, 'base64');
        const ivBuffer = Buffer.from(initialVector, 'base64');

        // The auth tag is the last 16 bytes of the encrypted data
        const authTag = flowDataBuffer.subarray(flowDataBuffer.length - 16);
        const encryptedData = flowDataBuffer.subarray(0, flowDataBuffer.length - 16);

        const decipher = crypto.createDecipheriv('aes-128-gcm', decryptedAesKey, ivBuffer);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(encryptedData),
            decipher.final()
        ]);

        return {
            decryptedData: JSON.parse(decrypted.toString('utf8')),
            aesKey: decryptedAesKey,
            iv: ivBuffer
        };
    } catch (error) {
        console.error('Flow Decryption Failed:', error);
        throw new Error('Failed to decrypt request');
    }
};

/**
 * Encrypts the response to WhatsApp Flows
 * @param {object} responseData - JSON object to respond with
 * @param {Buffer} aesKey - The AES key used in the request
 * @param {Buffer} iv - The IV used in the request (will be inverted)
 * @returns {string} Base64 encoded encrypted string
 */
export const encryptResponse = (responseData, aesKey, iv) => {
    try {
        // Flip the IV bits for response encryption rule
        const responseIv = Buffer.alloc(iv.length);
        for (let i = 0; i < iv.length; i++) {
            responseIv[i] = iv[i] ^ 255;
        }

        const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, responseIv);
        const encrypted = Buffer.concat([
            cipher.update(JSON.stringify(responseData), 'utf8'),
            cipher.final()
        ]);

        const authTag = cipher.getAuthTag();
        return Buffer.concat([encrypted, authTag]).toString('base64');
    } catch (error) {
        console.error('Flow Encryption Failed:', error);
        throw new Error('Failed to encrypt response');
    }
};
