import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone, maskValue } from "../src/core/maskingService.js";
import { detectSensitiveData, isValidMyNumber } from "../src/core/sensitiveDataDetector.js";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature12";
const PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----";

describe("sensitive data detector", () => {
  it("masks an email and a phone number", () => {
    expect(maskEmail("taro@example.com")).toBe("ta***@example.com");
    expect(maskPhone("090-1234-5678")).toBe("090-****-**78");
    expect(maskValue("credit_card", "4242424242424242", "mask")).toBe("[REDACTED:CREDIT_CARD]");
  });

  it("detects the MVP categories", () => {
    const text = [
      "taro@example.com",
      "090-1234-5678",
      "4242424242424242",
      JWT,
      "Bearer super-secret-token-value",
      "AKIAIOSFODNN7EXAMPLE",
      PRIVATE_KEY,
      "東京都千代田区丸の内1-1-1",
      "マイナンバー: 123456789012",
    ].join("\n");
    const categories = detectSensitiveData(text, [{ ruleId: "rule:0", keyword: "社外秘" }]).map((item) => item.category);
    expect(categories).toEqual(expect.arrayContaining([
      "email",
      "phone_number",
      "credit_card",
      "jwt",
      "bearer_token",
      "aws_access_key",
      "private_key",
      "address",
      "my_number",
    ]));
  });

  it("accepts a checksum-valid individual number and ignores a random 12-digit value", () => {
    expect(isValidMyNumber("123456789018")).toBe(true);
    expect(detectSensitiveData("id 123456789018").some((item) => item.category === "my_number")).toBe(true);
    expect(detectSensitiveData("id 123456789012").some((item) => item.category === "my_number")).toBe(false);
  });

  it("rejects a credit card that fails the luhn check", () => {
    expect(detectSensitiveData("4242424242424241")).toHaveLength(0);
  });

  it("normalizes fullwidth characters before matching", () => {
    const found = detectSensitiveData("ｔａｒｏ＠ｅｘａｍｐｌｅ．ｃｏｍ");
    expect(found).toHaveLength(1);
    expect(found[0]?.category).toBe("email");
    expect(found[0]?.value).toBe("taro@example.com");
  });

  it("does not flag ordinary prose", () => {
    expect(detectSensitiveData("今日は良い天気です。会議は15時です。")).toHaveLength(0);
  });

  it("matches a custom keyword without returning it twice when it overlaps itself", () => {
    const found = detectSensitiveData("社外秘の社外秘", [{ ruleId: "blocked:0", keyword: "社外秘" }]);
    expect(found).toHaveLength(2);
    expect(found.every((item) => item.category === "custom")).toBe(true);
  });
});
