// Password-locked storage for the GitHub token (WebCrypto only, no deps; works
// in browsers and in Node >= 20 so it can be unit-tested).
//
// The owner picks a password once; the token is then kept on this device only
// as AES-256-GCM ciphertext, with the key derived from the password by
// PBKDF2-SHA256 (600,000 iterations, random 16-byte salt). A script that reads
// localStorage therefore gets nothing it can use without the password, and the
// password itself is never stored.
//
// Limits worth knowing: this protects the token AT REST. While the editor is
// unlocked the token sits in sessionStorage for that tab (the API client needs
// it), and a weak password can still be guessed offline by someone who copies
// the ciphertext, hence the minimum length.
import {base64ToBytes, bytesToBase64} from "./github.js";

export const VAULT_VERSION = 1;
export const PBKDF2_ITERATIONS = 600_000;
export const MIN_PASSWORD_LENGTH = 10;

// Reject tampered parameters that would make unlocking hang or be trivial.
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 5_000_000;

const AAD = new TextEncoder().encode(`blogadmin-vault-v${VAULT_VERSION}`);

/** code: WRONG_PASSWORD | CORRUPT | UNSUPPORTED | NO_CRYPTO | WEAK_PASSWORD */
export class VaultError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "VaultError";
    this.code = code;
  }
}

function subtle() {
  const s = globalThis.crypto?.subtle;
  if (!s)
    throw new VaultError(
      "This browser context cannot encrypt (WebCrypto needs https:// or localhost).",
      "NO_CRYPTO"
    );
  return s;
}

// NFC so the same Hangul/accented password typed through different input
// methods (composed vs decomposed) derives the same key.
const normalize = password => String(password).normalize("NFC");

/** @returns {string|null} a message when the password is not acceptable */
export function passwordProblem(password) {
  const length = [...normalize(password)].length;
  if (length < MIN_PASSWORD_LENGTH)
    return `Use at least ${MIN_PASSWORD_LENGTH} characters (a short phrase works well).`;
  return null;
}

async function deriveKey(password, salt, iterations, usage) {
  const s = subtle();
  const base = await s.importKey(
    "raw",
    new TextEncoder().encode(normalize(password)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return s.deriveKey(
    {name: "PBKDF2", hash: "SHA-256", salt, iterations},
    base,
    {name: "AES-GCM", length: 256},
    false,
    usage
  );
}

/** Encrypts `token` under `password`. The result is plain JSON-safe data. */
export async function encryptToken(
  token,
  password,
  {iterations = PBKDF2_ITERATIONS} = {}
) {
  const problem = passwordProblem(password);
  if (problem) throw new VaultError(problem, "WEAK_PASSWORD");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations, ["encrypt"]);
  const ct = new Uint8Array(
    await subtle().encrypt(
      {name: "AES-GCM", iv, additionalData: AAD},
      key,
      new TextEncoder().encode(String(token))
    )
  );
  return {
    v: VAULT_VERSION,
    kdf: "PBKDF2-SHA256",
    iter: iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ct: bytesToBase64(ct)
  };
}

/** @returns {Promise<string>} the token. Throws VaultError. */
export async function decryptToken(vault, password) {
  if (!vault || typeof vault !== "object" || vault.v !== VAULT_VERSION)
    throw new VaultError(
      "The saved token is in an unknown format.",
      "UNSUPPORTED"
    );
  const {iter, salt: saltB64, iv: ivB64, ct: ctB64} = vault;
  if (
    vault.kdf !== "PBKDF2-SHA256" ||
    !Number.isInteger(iter) ||
    iter < MIN_ITERATIONS ||
    iter > MAX_ITERATIONS ||
    typeof saltB64 !== "string" ||
    typeof ivB64 !== "string" ||
    typeof ctB64 !== "string"
  )
    throw new VaultError("The saved token data is damaged.", "CORRUPT");
  let salt, iv, ct;
  try {
    salt = base64ToBytes(saltB64);
    iv = base64ToBytes(ivB64);
    ct = base64ToBytes(ctB64);
  } catch {
    throw new VaultError("The saved token data is damaged.", "CORRUPT");
  }
  if (salt.length !== 16 || iv.length !== 12 || ct.length < 17)
    throw new VaultError("The saved token data is damaged.", "CORRUPT");
  const key = await deriveKey(password, salt, iter, ["decrypt"]);
  try {
    const plain = await subtle().decrypt(
      {name: "AES-GCM", iv, additionalData: AAD},
      key,
      ct
    );
    return new TextDecoder().decode(plain);
  } catch {
    // AES-GCM authentication failed: wrong password (or tampered data)
    throw new VaultError("That password is not right.", "WRONG_PASSWORD");
  }
}
