import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

if (!process.env.CHAT_SECRET_KEY) {
  throw new Error("CHAT_SECRET_KEY is not defined in .env");
}

// Convert hex string (64 chars) → 32 byte buffer
const SECRET_KEY = Buffer.from(process.env.CHAT_SECRET_KEY, "hex");

if (SECRET_KEY.length !== 32) {
  throw new Error("CHAT_SECRET_KEY must be 32 bytes (64 hex characters)");
}

// 🔐 Encrypt
export const encryptMessage = (text) => {
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    SECRET_KEY,   // ✅ use directly
    iv
  );

  let encrypted = cipher.update(text, "utf8", "base64"); //(text to encrypt,textFormat,expectedFormat)
  encrypted += cipher.final("base64"); //If your message doesn’t perfectly fill a block, AES adds padding.

  return {
    encryptedData: encrypted,
    iv: iv.toString("base64"),
  };
};

// 🔓 Decrypt
export const decryptMessage = (encryptedText, iv) => {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    SECRET_KEY,   // ✅ use directly
    Buffer.from(iv, "base64")
  );

  let decrypted = decipher.update(encryptedText, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};