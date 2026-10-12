// Run: node --test test/vault.test.js
import {test} from "node:test";
import assert from "node:assert/strict";
import {
  MIN_PASSWORD_LENGTH,
  PBKDF2_ITERATIONS,
  VaultError,
  decryptToken,
  encryptToken,
  passwordProblem
} from "../src/admin/vault.js";

const TOKEN = "github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz";
const PW = "correct horse battery";
const FAST = {iterations: 100_000}; // the minimum the decryptor accepts

test("round trip returns the exact token", async () => {
  const vault = await encryptToken(TOKEN, PW, FAST);
  assert.equal(await decryptToken(vault, PW), TOKEN);
});

test("the stored form contains neither the token nor the password", async () => {
  const vault = await encryptToken(TOKEN, PW, FAST);
  const json = JSON.stringify(vault);
  assert.ok(!json.includes(TOKEN));
  assert.ok(!json.includes("github_pat"));
  assert.ok(!json.includes(PW));
  assert.deepEqual(Object.keys(vault).sort(), [
    "ct",
    "iter",
    "iv",
    "kdf",
    "salt",
    "v"
  ]);
});

test("default cost is 600k PBKDF2 iterations", async () => {
  assert.equal(PBKDF2_ITERATIONS, 600_000);
  const vault = await encryptToken(TOKEN, PW);
  assert.equal(vault.iter, 600_000);
  assert.equal(vault.kdf, "PBKDF2-SHA256");
});

test("a wrong password is rejected with WRONG_PASSWORD", async () => {
  const vault = await encryptToken(TOKEN, PW, FAST);
  await assert.rejects(
    () => decryptToken(vault, PW + "!"),
    e => e instanceof VaultError && e.code === "WRONG_PASSWORD"
  );
  await assert.rejects(
    () => decryptToken(vault, ""),
    e => e.code === "WRONG_PASSWORD"
  );
});

test("salt and iv are random: same input gives different ciphertext", async () => {
  const a = await encryptToken(TOKEN, PW, FAST);
  const b = await encryptToken(TOKEN, PW, FAST);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ct, b.ct);
});

test("tampered ciphertext is detected (AES-GCM authentication)", async () => {
  const vault = await encryptToken(TOKEN, PW, FAST);
  const bytes = Buffer.from(vault.ct, "base64");
  bytes[0] ^= 1;
  await assert.rejects(
    () => decryptToken({...vault, ct: bytes.toString("base64")}, PW),
    e => e.code === "WRONG_PASSWORD"
  );
});

test("changing the stored iteration count breaks decryption", async () => {
  const vault = await encryptToken(TOKEN, PW, FAST);
  await assert.rejects(
    () => decryptToken({...vault, iter: 100_001}, PW),
    e => e.code === "WRONG_PASSWORD"
  );
});

test("hostile or damaged vault data is refused before any work is done", async () => {
  const vault = await encryptToken(TOKEN, PW, FAST);
  for (const bad of [
    null,
    "x",
    {},
    {...vault, v: 2},
    {...vault, kdf: "scrypt"},
    {...vault, iter: 10},
    {...vault, iter: 1e9}, // would hang the page
    {...vault, iter: "600000"},
    {...vault, salt: "AAAA"},
    {...vault, iv: "AAAA"},
    {...vault, ct: "AAAA"},
    {...vault, ct: 5}
  ]) {
    await assert.rejects(
      () => decryptToken(bad, PW),
      e =>
        e instanceof VaultError && ["UNSUPPORTED", "CORRUPT"].includes(e.code),
      JSON.stringify(bad)?.slice(0, 60)
    );
  }
});

test("a short password cannot create a vault", async () => {
  assert.ok(passwordProblem("short"));
  assert.ok(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH - 1)));
  assert.equal(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH)), null);
  await assert.rejects(
    () => encryptToken(TOKEN, "short", FAST),
    e => e.code === "WEAK_PASSWORD"
  );
});

test("Korean passwords work, and composed/decomposed Hangul are the same password", async () => {
  const composed = "안녕하세요 비밀번호 입니다"; // NFC
  const decomposed = composed.normalize("NFD"); // what some input paths produce
  assert.notEqual(composed, decomposed);
  const vault = await encryptToken(TOKEN, composed, FAST);
  assert.equal(await decryptToken(vault, decomposed), TOKEN);
  assert.equal(await decryptToken(vault, composed), TOKEN);
  // each Hangul syllable counts as one character, not three jamo
  assert.equal(passwordProblem("한글열자짜리비번입니다"), null);
});

test("tokens with unusual content survive (unicode, long)", async () => {
  const odd = "ghp_" + "é한😀".repeat(40);
  const vault = await encryptToken(odd, PW, FAST);
  assert.equal(await decryptToken(vault, PW), odd);
});
