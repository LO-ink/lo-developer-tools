import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const root = fileURLToPath(new URL("..", import.meta.url));
test("native documentation keeps foreign integrations in adapter links and local links resolve", () => {
  for (const path of [
    "README.md",
    ...readdirSync(resolve(root, "docs"))
      .filter((name) => name.endsWith(".md"))
      .map((name) => "docs/" + name),
  ]) {
    const body = readFileSync(resolve(root, path), "utf8");
    assert.doesNotMatch(
      body,
      /telegram|t\.me\/|vk\.com|no-AI|inline_keyboard|callback_data|web_app/i,
      path,
    );
    for (const match of body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (!/^(https?:|#|mailto:)/.test(target)) {
        assert.doesNotThrow(
          () =>
            readFileSync(resolve(root, dirname(path), target.split("#")[0])),
          `${path}: ${target}`,
        );
      }
    }
  }
});
test("credential scanner captures the whole LO token and rejects truncated or adjacent values", () => {
  const configuration = readFileSync(
    resolve(root, "security/gitleaks.toml"),
    "utf8",
  );
  const regex = new RegExp(configuration.match(/regex = '''([^']+)'''/)[1]);
  const token = "42:" + "A".repeat(42) + "_";
  for (const wrapped of [token, '"' + token + '"', "token=" + token + "\n"])
    assert.equal(regex.exec(wrapped)?.[1], token);
  for (const value of [
    "0:" + "A".repeat(43),
    "42:" + "A".repeat(42),
    "42:" + "A".repeat(44),
    "word" + token,
  ])
    assert.equal(regex.test(value), false);
  assert.match(configuration, /secretGroup = 1/);
});
