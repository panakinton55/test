import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export type RawKeyPair = {
  publicKey: Buffer;
  privateKey: Buffer;
};

export function generateEd25519(): RawKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const privateDer = privateKey.export({ format: "der", type: "pkcs8" });
  const publicDer = publicKey.export({ format: "der", type: "spki" });
  return {
    privateKey: Buffer.from(privateDer.subarray(privateDer.length - 32)),
    publicKey: Buffer.from(publicDer.subarray(publicDer.length - 32)),
  };
}

export function publicKeyToDidKey(publicKey: Buffer): string {
  if (publicKey.length !== 32) throw new Error("expected a 32-byte public key");
  return `did:key:z${base58btcEncode(Buffer.concat([Buffer.from([0xed, 0x01]), publicKey]))}`;
}

export function didKeyToPublicKey(subjectId: string): Buffer {
  if (!subjectId.startsWith("did:key:z")) throw new Error("unsupported subject");
  const decoded = base58btcDecode(subjectId.slice("did:key:z".length));
  if (decoded.length !== 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error("unsupported subject");
  }
  return decoded.subarray(2);
}

export function signBytes(privateKey: Buffer, data: Buffer): Buffer {
  return sign(null, data, createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, privateKey]), format: "der", type: "pkcs8" }));
}

export function verifyBytes(publicKey: Buffer, data: Buffer, signature: Buffer): boolean {
  return verify(null, data, createPublicKey({ key: Buffer.concat([SPKI_PREFIX, publicKey]), format: "der", type: "spki" }), signature);
}

export function base58btcEncode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    encoded = (ALPHABET[Number(value % 58n)] ?? "") + encoded;
    value /= 58n;
  }
  return `${"1".repeat(zeros)}${encoded}`;
}

export function base58btcDecode(text: string): Buffer {
  let zeros = 0;
  while (zeros < text.length && text[zeros] === "1") zeros += 1;
  let value = 0n;
  for (const char of text) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("invalid base58");
    value = value * 58n + BigInt(index);
  }
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.push(Number(value & 255n));
    value >>= 8n;
  }
  bytes.reverse();
  return Buffer.concat([Buffer.alloc(zeros), Buffer.from(bytes)]);
}
