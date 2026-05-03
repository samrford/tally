// E2E encryption helpers — all WebCrypto, zero deps.
//
// Threat model: Even those with DB access cannot read user data. The server only
// ever sees ciphertext. Forgotten data passphrase = data lost forever.
//
// Format: every encrypted blob is `IV (12 bytes) || ciphertext+authTag`,
// base64-encoded for transit. AES-GCM 256, PBKDF2-SHA256 with 600k iterations
// for the KEK derivation.

const PBKDF2_ITERATIONS = 600_000
const SALT_BYTES = 16
const IV_BYTES = 12
const DEK_BYTES = 32 // 256-bit AES-GCM key

export interface WrappedKeyMaterialB64 {
  wrappedDek: string
  salt: string
  iterations: number
}

// All Uint8Arrays in this file are explicitly ArrayBuffer-backed (not
// SharedArrayBuffer) — TS6's WebCrypto types require this distinction.
type Bytes = Uint8Array<ArrayBuffer>

// --- base64 helpers ----------------------------------------------------

function bytesToBase64(bytes: Bytes): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function base64ToBytes(b64: string): Bytes {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function sliceFresh(src: Bytes, start: number, end?: number): Bytes {
  const len = (end ?? src.length) - start
  const out = new Uint8Array(len)
  out.set(src.subarray(start, end))
  return out
}

function concat(a: Bytes, b: Bytes): Bytes {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

// --- KDF ---------------------------------------------------------------

async function deriveKEK(
  passphrase: string,
  salt: Bytes,
  iterations: number,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// --- DEK wrap / unwrap -------------------------------------------------

// Generate a fresh DEK + wrap it with a passphrase-derived KEK.
// Returns the raw DEK bytes (for keystore to persist + import) and the
// wrapped material to POST to the server.
export async function generateAndWrapDek(passphrase: string): Promise<{
  dekBytes: Bytes
  wrapped: WrappedKeyMaterialB64
}> {
  const salt: Bytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const dekBytes: Bytes = crypto.getRandomValues(new Uint8Array(DEK_BYTES))
  const kek = await deriveKEK(passphrase, salt, PBKDF2_ITERATIONS)

  const iv: Bytes = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const wrappedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    kek,
    dekBytes,
  )
  const wrappedBytes = new Uint8Array(wrappedBuf.byteLength)
  wrappedBytes.set(new Uint8Array(wrappedBuf))

  return {
    dekBytes,
    wrapped: {
      wrappedDek: bytesToBase64(concat(iv, wrappedBytes)),
      salt: bytesToBase64(salt),
      iterations: PBKDF2_ITERATIONS,
    },
  }
}

// Re-derive the KEK from passphrase + stored salt/iterations and unwrap
// the DEK. Throws on wrong passphrase (AES-GCM auth tag mismatch).
export async function unwrapDek(
  passphrase: string,
  wrapped: WrappedKeyMaterialB64,
): Promise<Bytes> {
  const salt = base64ToBytes(wrapped.salt)
  const combined = base64ToBytes(wrapped.wrappedDek)
  const iv = sliceFresh(combined, 0, IV_BYTES)
  const ct = sliceFresh(combined, IV_BYTES)

  const kek = await deriveKEK(passphrase, salt, wrapped.iterations)
  const dekBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kek, ct)
  const out = new Uint8Array(dekBuf.byteLength)
  out.set(new Uint8Array(dekBuf))
  return out
}

// --- DEK as CryptoKey for record encrypt/decrypt -----------------------

export async function importDek(rawBytes: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawBytes,
    'AES-GCM',
    false, // non-extractable runtime; raw bytes still live in sessionStorage
    ['encrypt', 'decrypt'],
  )
}

// --- Record encrypt / decrypt -----------------------------------------

export async function encryptJSON<T>(value: T, dek: CryptoKey): Promise<string> {
  const plaintextBuf = new TextEncoder().encode(JSON.stringify(value))
  const plaintext = new Uint8Array(plaintextBuf.byteLength)
  plaintext.set(plaintextBuf)

  const iv: Bytes = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, plaintext)
  const ct = new Uint8Array(ctBuf.byteLength)
  ct.set(new Uint8Array(ctBuf))

  return bytesToBase64(concat(iv, ct))
}

export async function decryptJSON<T>(b64: string, dek: CryptoKey): Promise<T> {
  const combined = base64ToBytes(b64)
  const iv = sliceFresh(combined, 0, IV_BYTES)
  const ct = sliceFresh(combined, IV_BYTES)
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, ct)
  const plaintext = new Uint8Array(buf.byteLength)
  plaintext.set(new Uint8Array(buf))
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}

// --- Raw bytes <-> base64 (used by keystore for sessionStorage) -------

export function bytesToBase64Public(bytes: Bytes): string {
  return bytesToBase64(bytes)
}

export function base64ToBytesPublic(b64: string): Bytes {
  return base64ToBytes(b64)
}
