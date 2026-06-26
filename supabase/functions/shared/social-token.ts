// supabase/functions/shared/social-token.ts
// AES-256-GCM authenticated encryption for social OAuth tokens.
//
// Key: SOCIAL_TOKEN_ENCRYPTION_KEY Supabase secret — exactly 64 hex chars (32 bytes).
// Wire format: "<iv_base64>:<ciphertext_base64>"
// The 12-byte IV is random per token; AES-GCM authentication tag is included
// in the ciphertext (WebCrypto appends it automatically).
//
// NEVER log tokens, keys, or IVs.

function hexToBytes(hex: string): Uint8Array {
  if (hex.length !== 64) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function toB64(bytes: Uint8Array): string {
  // btoa requires a binary string; spread avoids stack overflow on large buffers
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromB64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importAesKey(keyHex: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    hexToBytes(keyHex),
    { name: "AES-GCM" },
    false,
    usages,
  );
}

export async function encryptToken(plainToken: string, keyHex: string): Promise<string> {
  const key = await importAesKey(keyHex, ["encrypt"]);
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plainToken),
  );
  return `${toB64(iv)}:${toB64(new Uint8Array(ct))}`;
}

export async function decryptToken(encryptedToken: string, keyHex: string): Promise<string> {
  if (!encryptedToken || encryptedToken === "") {
    throw new Error("Token has been revoked or is missing");
  }
  const sep = encryptedToken.indexOf(":");
  if (sep === -1) throw new Error("Invalid encrypted token format");

  const iv = fromB64(encryptedToken.slice(0, sep));
  const ct = fromB64(encryptedToken.slice(sep + 1));

  const key = await importAesKey(keyHex, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(plain);
}
