import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENVELOPE_VERSION = "v1";
const IV_BYTES = 12;

function getEncryptionKey() {
  const encoded = process.env.LAB_LLM_CONFIG_ENCRYPTION_KEY?.trim();
  if (!encoded) {
    throw new Error("LAB_LLM_CONFIG_ENCRYPTION_KEY_MISSING");
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("LAB_LLM_CONFIG_ENCRYPTION_KEY_INVALID");
  }
  return key;
}

/** Encrypt a shared-model secret before database persistence (AES-256-GCM). */
export function encryptLabLlmSecret(value: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENVELOPE_VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/** Decrypt only inside a server-side runtime path; never return this value to a client. */
export function decryptLabLlmSecret(envelope: string) {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded, extra] = envelope.split(":");
  if (version !== ENVELOPE_VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded || extra) {
    throw new Error("LAB_LLM_SECRET_INVALID");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivEncoded, "base64"));
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, "base64")), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("LAB_LLM_CONFIG_ENCRYPTION_KEY")) throw error;
    throw new Error("LAB_LLM_SECRET_INVALID");
  }
}
