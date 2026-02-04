// WebAuthn type declarations for Node.js environment
// These are browser-specific types that may not be available in Node.js

declare global {
  interface AuthenticatorResponse {
    clientDataJSON: ArrayBuffer;
  }

  interface AuthenticatorAttestationResponse extends AuthenticatorResponse {
    attestationObject: ArrayBuffer;
  }

  interface AuthenticationExtensionsClientOutputs {
    [key: string]: any;
  }
}

export {};