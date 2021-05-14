/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { StringDict } from "@azure/msal-common";
import { Base64Decode } from "../encode/Base64Decode";
import { JsonWebEncryptionError } from "../error/JsonWebEncryptionError";
import { BROWSER_CRYPTO } from "../utils/BrowserConstants";
import { BrowserStringUtils } from "../utils/BrowserStringUtils";

export type JoseHeader = {
    alg: string,
    enc: string,
    ctx: string,
    label: string
};

export type UnwrappingAlgorithmPair = {
    decryption: string,
    encryption: string
};

const KEY_ALGORITHM_MAP: StringDict = {
    "RSA-OAEP-256": BROWSER_CRYPTO.RSA_OAEP,
    "A256GCM": BROWSER_CRYPTO.AES_GCM,
    "dir": BROWSER_CRYPTO.DIRECT
};

/**
 * This class deserializes a string in JWE Compact Serialization format into
 * it's decoded elements. The class also provides the validation, parsing and
 * decryption functionality for the resulting JWE.
 * 
 * See IETF RFC 7516 for the JsonWebEncryption Specification
 * https://tools.ietf.org/html/rfc7516
 */

export class JsonWebEncryption {
    private base64Decode: Base64Decode;
    private header: JoseHeader;
    private encryptedKey: string;
    private initializationVector: string;
    private ciphertext: string;
    private authenticationTag: string;
    private unwrappingAlgorithms: UnwrappingAlgorithmPair;

    constructor(rawJwe: string) {
        this.base64Decode = new Base64Decode();
        const jweComponents = rawJwe.split(".");
        this.header = this.parseJweProtectedHeader(jweComponents[0]);
        this.unwrappingAlgorithms = this.setUnwrappingAlgorithms();
        this.encryptedKey = this.base64Decode.base64URLdecode(jweComponents[1]);
        this.initializationVector = this.base64Decode.base64URLdecode(jweComponents[2]);
        this.ciphertext = this.base64Decode.base64URLdecode(jweComponents[3]);
        this.authenticationTag = this.base64Decode.base64URLdecode(jweComponents[4]);
    }

    get protectedHeader(): JoseHeader {
        return this.header;
    }

    /**
     * Unwrapping a JWE encrypted key is done in two steps:
     *  1. Decrypt the base64Url decode encrypted key component using the algorithm
     *     specified in the "alg" attribute of the JWE header
     *  2. Import the result of previous step as a CryptoKey, setting the key algorithm to the one
     *     specified in the "enc" attribute of the JWE header
     * 
     * @param unwrappingKey - The private key from an asymmetric key pair in CryptoKey format
     * @param keyUsages - An array containing the usages for the imported key
     */
    async unwrap(unwrappingKey: CryptoKey, keyUsages: KeyUsage[]): Promise<CryptoKey> {
        const encryptedKeyBuffer = BrowserStringUtils.stringToArrayBuffer(this.encryptedKey);
        const contentEncryptionKey = await window.crypto.subtle.decrypt(this.unwrappingAlgorithms.decryption, unwrappingKey, encryptedKeyBuffer);
        return await window.crypto.subtle.importKey(
            "raw",
            contentEncryptionKey,
            {
                name: "HMAC",
                hash: {
                    name: "SHA-256"
                },
            },
            false,
            keyUsages);
    }

    private parseJweProtectedHeader(encodedHeader: string): JoseHeader {
        const decodedHeader = this.base64Decode.base64URLdecode(encodedHeader);
        try {
            return JSON.parse(decodedHeader);
        } catch (error) {
            throw JsonWebEncryptionError.createJweHeaderNotParsedError();
        }
    }

    private setUnwrappingAlgorithms(): UnwrappingAlgorithmPair {
        return {
            decryption: this.matchKeyAlgorithm(this.header.alg),
            encryption: this.matchKeyAlgorithm(this.header.enc)
        };
    }

    private matchKeyAlgorithm(label: string): string {
        const matchedAlgorithm = KEY_ALGORITHM_MAP[label];

        if (matchedAlgorithm) {
            return matchedAlgorithm;
        } else {
            throw JsonWebEncryptionError.createHeaderAlgorithmMismatch(label);
        }
    }
}