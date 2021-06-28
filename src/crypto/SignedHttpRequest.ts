/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { CryptoOps } from "./CryptoOps";
import { PopTokenGenerator, SignedHttpRequestParameters } from "@azure/msal-common";

export class SignedHttpRequest {
    private popTokenGenerator: PopTokenGenerator;
    private cryptoOpts: CryptoOps;
    private shrParameters: SignedHttpRequestParameters;

    constructor(shrParameters: SignedHttpRequestParameters) {
        this.cryptoOpts = new CryptoOps();
        this.popTokenGenerator = new PopTokenGenerator(this.cryptoOpts);
        this.shrParameters = shrParameters;
    }

    /**
     * Generates and caches a keypair for the given request options.
     * @returns Public key digest, which should be sent to the token issuer.
     */
    async generatePublicKey(): Promise<string> {
        const { kid } = await this.popTokenGenerator.generateKid(this.shrParameters);

        return kid;
    }

    /**
     * Generates a signed http request for the given payload with the given key.
     * @param payload Payload to sign (e.g. access token)
     * @param publicKey Public key digest (from generatePublicKey API)
     * @param claims Additional claims to include/override in the signed JWT 
     * @returns Pop token signed with the corresponding private key
     */
    async signPopToken(payload: string, publicKey: string, claims?: object): Promise<string> {
        return this.popTokenGenerator.signPayload(
            payload, 
            publicKey,
            this.shrParameters, 
            claims
        );
    }
}