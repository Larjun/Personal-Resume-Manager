import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeNextPath("/resumes/abc?x=1#y")).toBe("/resumes/abc?x=1#y");
    expect(safeNextPath("/")).toBe("/");
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "evil.com",
      "javascript:alert(1)",
      "/\tevil",
      "",
      undefined,
      null,
      42,
    ]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("//x", "/account")).toBe("/account");
  });
});

describe("isPublicPath", () => {
  it("allows auth pages and the /auth/* handlers", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/signup")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("protects everything else, including look-alike prefixes", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/resumes/abc")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/auth")).toBe(false);
  });
});
