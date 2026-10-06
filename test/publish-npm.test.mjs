import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  chmodSync,
  symlinkSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  publishedVersion,
  publishPackages,
  readPackages,
} from "../actions/publish-npm/publish.mjs";

const identity = { name: "@lo-ink/example", version: "1.2.3" };
const archive = Buffer.from("tested package archive");
const integrity = `sha512-${createHash("sha512").update(archive).digest("base64")}`;
const tarball = "https://registry.npmjs.org/lo-ink-example-1.2.3.tgz";
const publicMetadata = { ...identity, dist: { integrity, tarball } };
const archiveResponse = () => ({
  status: 200,
  ok: true,
  arrayBuffer: async () => archive,
});
const response = (status, body) => ({
  status,
  ok: status === 200,
  json: async () => body,
});

test("a missing version is distinguished from registry outages and authentication failures", async () => {
  assert.equal(
    await publishedVersion(identity, async () => response(404)),
    null,
  );
  for (const status of [401, 403, 429, 500, 503]) {
    await assert.rejects(
      publishedVersion(identity, async () => response(status)),
      new RegExp(`HTTP ${status}`),
    );
  }
  await assert.rejects(
    publishedVersion(identity, async () => {
      throw new Error("network failure");
    }),
    /network failure/,
  );
});

test("unexpected registry identity and malformed metadata stop publication", async () => {
  await assert.rejects(
    publishedVersion(identity, async () =>
      response(200, { ...identity, version: "1.2.4" }),
    ),
    /identity/,
  );
  await assert.rejects(
    publishedVersion(identity, async () => ({
      status: 200,
      ok: true,
      json: async () => {
        throw new Error("invalid JSON");
      },
    })),
    /invalid JSON/,
  );
});

test("already published immutable versions are packed and verified without republishing", async () => {
  const commands = [];
  const result = await publishPackages([identity], {
    fetcher: async (url) =>
      url === tarball ? archiveResponse() : response(200, publicMetadata),
    execute: executor(commands),
    log: () => {},
  });
  assert.equal(commands.filter((args) => args[0] === "pack").length, 1);
  assert.equal(commands.filter((args) => args[0] === "publish").length, 0);
  assert.equal(result[0].status, "already published");
  assert.equal(result[0].integrity, integrity);
});

function packageArchive(
  files = { "index.js": "export const value = 42;" },
  executable = false,
  link = false,
) {
  const root = mkdtempSync(join(tmpdir(), "lo-release-content-"));
  try {
    mkdirSync(join(root, "package"));
    writeFileSync(join(root, "package/package.json"), JSON.stringify(identity));
    for (const [name, content] of Object.entries(files))
      writeFileSync(join(root, "package", name), content);
    if (executable) chmodSync(join(root, "package/index.js"), 0o755);
    if (link) symlinkSync("index.js", join(root, "package/link.js"));
    execFileSync("tar", [
      "-czf",
      join(root, "archive.tgz"),
      "-C",
      root,
      "package",
    ]);
    return readFileSync(join(root, "archive.tgz"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const sha512 = (bytes) =>
  `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
function contentExecutor(commands, bytes) {
  return (command, args, options) => {
    assert.equal(command, "npm");
    commands.push(args);
    if (args[0] === "run") return;
    assert.equal(args[0], "pack", "verification must finish before any upload");
    const name = options.cwd === "new" ? "@lo-ink/new" : identity.name;
    const filename = "fixture.tgz";
    writeFileSync(join(args.at(-1), filename), bytes);
    return JSON.stringify([
      { ...identity, name, filename, integrity: sha512(bytes) },
    ]);
  };
}
function contentRegistry(bytes) {
  return async (url) =>
    url.endsWith(".tgz")
      ? { status: 200, ok: true, arrayBuffer: async () => bytes }
      : url.includes("%2Fnew")
        ? response(404)
        : response(200, {
            ...identity,
            dist: {
              integrity: sha512(bytes),
              tarball: `${"https://registry.npmjs.org"}/fixture.tgz`,
            },
          });
}

test("equivalent published files tolerate different gzip headers without republishing", async () => {
  const local = packageArchive(),
    published = Buffer.from(local);
  published[4] ^= 1;
  assert.notEqual(sha512(local), sha512(published));
  const commands = [];
  const result = await publishPackages([identity], {
    fetcher: contentRegistry(published),
    execute: contentExecutor(commands, local),
    log: () => {},
  });
  assert.equal(result[0].status, "already published");
  assert.equal(result[0].integrity, sha512(published));
  assert.equal(
    commands.some((args) => args[0] === "publish"),
    false,
  );
});

test("changed, missing, added or executable published files stop the entire release before uploading", async () => {
  const local = packageArchive();
  for (const published of [
    packageArchive({ "index.js": "export const value = 41;" }),
    packageArchive({}),
    packageArchive({
      "index.js": "export const value = 42;",
      "extra.js": "changed",
    }),
    packageArchive(undefined, true),
  ]) {
    const commands = [];
    await assert.rejects(
      publishPackages(
        [{ ...identity, name: "@lo-ink/new", cwd: "new" }, identity],
        {
          fetcher: contentRegistry(published),
          execute: contentExecutor(commands, local),
          log: () => {},
        },
      ),
      /source differs.*bump its version/,
    );
    assert.equal(
      commands.some((args) => args[0] === "publish"),
      false,
    );
  }
});

test("published archive verification rejects missing integrity, foreign URLs, corrupted bytes and links", async () => {
  const local = packageArchive(),
    changed = packageArchive({ "index.js": "changed" });
  for (const [dist, bytes, pattern] of [
    [{}, changed, /SHA-512/],
    [
      {
        integrity: sha512(changed),
        tarball: "https://example.com/fixture.tgz",
      },
      changed,
      /archive URL/,
    ],
    [
      {
        integrity: sha512(changed),
        tarball: "https://registry.npmjs.org/fixture.tgz",
      },
      local,
      /integrity mismatch/,
    ],
  ]) {
    await assert.rejects(
      publishPackages([identity], {
        fetcher: async (url) =>
          url.endsWith(".tgz")
            ? { ok: true, arrayBuffer: async () => bytes }
            : response(200, { ...identity, dist }),
        execute: contentExecutor([], local),
        log: () => {},
      }),
      pattern,
    );
  }
  await assert.rejects(
    publishPackages([identity], {
      fetcher: contentRegistry(packageArchive(undefined, false, true)),
      execute: contentExecutor([], local),
      log: () => {},
    }),
    /regular files/,
  );
});

test("a fresh linked workspace builds a published dependency before its unpublished dependent", async () => {
  const root = mkdtempSync(join(tmpdir(), "lo-release-build-"));
  try {
    mkdirSync(join(root, "base"));
    mkdirSync(join(root, "dependent"));
    writeFileSync(
      join(root, "base", "package.json"),
      JSON.stringify({
        name: "@lo-ink/base",
        scripts: { prepack: "node build.mjs" },
      }),
    );
    writeFileSync(
      join(root, "base", "build.mjs"),
      'import fs from "node:fs"; fs.mkdirSync("dist"); fs.writeFileSync("dist/index.mjs", "export const value = 42;");',
    );
    mkdirSync(join(root, "dependent", "node_modules", "@lo-ink"), {
      recursive: true,
    });
    const { symlinkSync } = await import("node:fs");
    symlinkSync(
      join(root, "base"),
      join(root, "dependent", "node_modules", "@lo-ink", "base"),
      "dir",
    );
    writeFileSync(
      join(root, "dependent", "package.json"),
      JSON.stringify({
        name: "@lo-ink/dependent",
        scripts: { prepack: "node build.mjs" },
      }),
    );
    writeFileSync(
      join(root, "dependent", "build.mjs"),
      'import {value} from "./node_modules/@lo-ink/base/dist/index.mjs"; import fs from "node:fs"; if(value !== 42) throw Error("wrong dependency"); fs.writeFileSync("built", "ok");',
    );
    const packages = [
      { ...identity, name: "@lo-ink/base", cwd: join(root, "base") },
      { ...identity, name: "@lo-ink/dependent", cwd: join(root, "dependent") },
    ];
    const commands = [];
    await assert.rejects(
      publishPackages(packages, {
        fetcher: async (url) =>
          url.includes("base") ? response(200, packages[0]) : response(404),
        execute: (command, args, options) => {
          commands.push(args);
          if (args[0] === "run")
            return execFileSync(command, args, { ...options, stdio: "pipe" });
          assert.equal(existsSync(join(root, "dependent", "built")), true);
          throw new Error("stop before real publication");
        },
        log: () => {},
      }),
      /stop before real publication/,
    );
    assert.equal(commands.filter((args) => args[0] === "run").length, 2);
    assert.equal(commands.filter((args) => args[0] === "publish").length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function executor(
  commands,
  mutate = (metadata) => metadata,
  failPublish = false,
) {
  return (command, args) => {
    assert.equal(command, "npm");
    commands.push(args);
    if (args[0] === "run") return;
    if (args[0] === "publish") {
      if (failPublish) throw new Error("upload refused");
      return;
    }
    const destination = args.at(-1);
    const filename = "lo-ink-example-1.2.3.tgz";
    writeFileSync(join(destination, filename), archive);
    return JSON.stringify([mutate({ ...identity, filename, integrity })]);
  };
}

test("the exact packed archive is published once and public integrity is checked", async () => {
  const commands = [];
  let lookup = 0;
  const result = await publishPackages([{ ...identity, cwd: tmpdir() }], {
    fetcher: async (url) =>
      url === tarball
        ? archiveResponse()
        : ++lookup === 1
          ? response(404)
          : response(200, publicMetadata),
    execute: executor(commands),
    log: () => {},
  });
  assert.equal(result[0].integrity, integrity);
  assert.equal(commands.filter((args) => args[0] === "publish").length, 1);
  assert.equal(commands.find((args) => args[0] === "publish").at(-1), "latest");
  assert.equal(
    existsSync(commands.find((args) => args[0] === "publish")[1]),
    false,
  );
  assert.ok(
    commands.find((args) => args[0] === "pack").includes("--ignore-scripts"),
  );
});

test("a failed upload is never retried automatically and its temporary archive is removed", async () => {
  const commands = [];
  await assert.rejects(
    publishPackages([{ ...identity, cwd: tmpdir() }], {
      fetcher: async () => response(404),
      execute: executor(commands, (x) => x, true),
      log: () => {},
    }),
    /upload refused/,
  );
  assert.equal(commands.filter((args) => args[0] === "publish").length, 1);
  assert.equal(
    existsSync(commands.find((args) => args[0] === "publish")[1]),
    false,
  );
});

test("incorrect packed identity, paths and integrity prevent npm publish", async () => {
  for (const mutate of [
    (x) => ({ ...x, name: "@lo-ink/other" }),
    (x) => ({ ...x, filename: "../unexpected.tgz" }),
    (x) => ({ ...x, integrity: "sha512-invalid" }),
  ]) {
    const commands = [];
    await assert.rejects(
      publishPackages([{ ...identity, cwd: tmpdir() }], {
        fetcher: async () => response(404),
        execute: executor(commands, mutate),
        log: () => {},
      }),
      /archive/i,
    );
    assert.equal(commands.filter((args) => args[0] === "publish").length, 0);
  }
});

test("a successful upload with unexpected public bytes fails verification without republishing", async () => {
  const commands = [];
  let lookup = 0;
  await assert.rejects(
    publishPackages([{ ...identity, cwd: tmpdir() }], {
      fetcher: async () =>
        ++lookup === 1
          ? response(404)
          : response(200, { ...identity, dist: { integrity: "different" } }),
      execute: executor(commands),
      log: () => {},
    }),
    /Public registry integrity/,
  );
  assert.equal(commands.filter((args) => args[0] === "publish").length, 1);
});

test("package selection rejects private packages, foreign repositories, path escapes and duplicates", () => {
  const root = mkdtempSync(join(tmpdir(), "lo-release-input-"));
  const base = {
    ...identity,
    repository: { url: "git+https://github.com/LO-ink/example.git" },
  };
  const write = (pkg) =>
    writeFileSync(join(root, "package.json"), JSON.stringify(pkg));
  try {
    write(base);
    assert.equal(readPackages(root, ["."], "LO-ink/example").length, 1);
    assert.throws(
      () => readPackages(root, [".", "."], "LO-ink/example"),
      /duplicates/,
    );
    assert.throws(
      () => readPackages(root, [".."], "LO-ink/example"),
      /escapes/,
    );
    assert.throws(
      () => readPackages(root, [root], "LO-ink/example"),
      /relative/,
    );
    assert.throws(() => readPackages(root, ["."], "LO-ink/other"), /metadata/);
    write({ ...base, private: true });
    assert.throws(() => readPackages(root, ["."], "LO-ink/example"), /public/);
    write({ ...base, version: "latest" });
    assert.throws(() => readPackages(root, ["."], "LO-ink/example"), /version/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("workspace packages are released in dependency order", () => {
  const root = mkdtempSync(join(tmpdir(), "lo-release-order-"));
  try {
    for (const name of ["base", "dependent"]) {
      mkdirSync(join(root, name));
      writeFileSync(
        join(root, name, "package.json"),
        JSON.stringify({
          ...identity,
          name: `@lo-ink/${name}`,
          repository: { url: "https://github.com/LO-ink/example.git" },
          dependencies:
            name === "dependent" ? { "@lo-ink/base": "1.2.3" } : undefined,
        }),
      );
    }
    assert.throws(
      () => readPackages(root, ["dependent", "base"], "LO-ink/example"),
      /before/,
    );
    assert.equal(
      readPackages(root, ["base", "dependent"], "LO-ink/example").length,
      2,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("repository metadata must preserve the case of the GitHub provenance identity", () => {
  const root = mkdtempSync(join(tmpdir(), "lo-release-provenance-"));
  try {
    for (const url of [
      "https://github.com/LO-ink/example",
      "https://github.com/LO-ink/example.git",
      "git+https://github.com/LO-ink/example.git",
    ]) {
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ ...identity, repository: { url } }),
      );
      assert.equal(readPackages(root, ["."], "LO-ink/example").length, 1);
    }
    for (const url of [
      "https://github.com/lo-ink/example.git",
      "git+https://github.com/lo-ink/example.git",
      "https://github.com/LO-ink/Example.git",
    ]) {
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ ...identity, repository: { url } }),
      );
      assert.throws(
        () => readPackages(root, ["."], "LO-ink/example"),
        /Repository metadata/,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an accepted upload can take several minutes to become public without a second upload", async () => {
  const commands = [];
  const delays = [];
  let lookups = 0;
  const result = await publishPackages([{ ...identity, cwd: tmpdir() }], {
    fetcher: async (url) =>
      url === tarball
        ? archiveResponse()
        : ++lookups < 18
          ? response(404)
          : response(200, publicMetadata),
    execute: executor(commands),
    wait: async (ms) => {
      delays.push(ms);
    },
    log: () => {},
  });
  assert.equal(result[0].status, "published");
  assert.equal(commands.filter((args) => args[0] === "publish").length, 1);
  assert.equal(delays.length, 16);
  assert.ok(delays.every((ms) => ms === 10_000));
});

test("an accepted version still processing fails with a pending error rather than a false integrity mismatch", async () => {
  const commands = [];
  await assert.rejects(
    publishPackages([{ ...identity, cwd: tmpdir() }], {
      fetcher: async () => response(404),
      execute: executor(commands),
      verificationAttempts: 2,
      wait: async () => {},
      log: () => {},
    }),
    /accepted the upload but the version is not public yet/,
  );
  assert.equal(commands.filter((args) => args[0] === "publish").length, 1);
});

test("existing and newly uploaded metadata wait for canonical archive bytes before reporting success", async () => {
  for (const existing of [false, true]) {
    const commands = [],
      delays = [],
      messages = [];
    let lookups = 0,
      downloads = 0;
    const result = await publishPackages([identity], {
      fetcher: async (url, options) => {
        if (url === tarball) {
          assert.equal(options.redirect, "error");
          assert.equal(
            messages.length,
            0,
            "success was logged before download verification",
          );
          return ++downloads < 3 ? response(404) : archiveResponse();
        }
        return ++lookups === 1 && !existing
          ? response(404)
          : response(200, publicMetadata);
      },
      execute: executor(commands),
      wait: async (ms) => delays.push(ms),
      verificationAttempts: 3,
      log: (message) => messages.push(message),
    });
    assert.equal(
      result[0].status,
      existing ? "already published" : "published",
    );
    assert.equal(downloads, 3);
    assert.deepEqual(delays, [10_000, 10_000]);
    assert.equal(
      commands.filter((args) => args[0] === "publish").length,
      existing ? 0 : 1,
    );
    assert.equal(messages.length, 1);
  }
});

test("metadata without a downloadable archive never succeeds or resubmits an accepted upload", async () => {
  for (const existing of [false, true]) {
    const commands = [];
    let lookups = 0,
      downloads = 0;
    await assert.rejects(
      publishPackages([identity], {
        fetcher: async (url) => {
          if (url === tarball) {
            downloads++;
            return response(404);
          }
          return ++lookups === 1 && !existing
            ? response(404)
            : response(200, publicMetadata);
        },
        execute: executor(commands),
        wait: async () => {},
        verificationAttempts: 2,
        log: () => assert.fail("unavailable package reported success"),
      }),
      /archive is not public yet; do not resend/,
    );
    assert.equal(downloads, 2);
    assert.equal(
      commands.filter((args) => args[0] === "publish").length,
      existing ? 0 : 1,
    );
  }
});

test("an unavailable existing archive blocks every upload including an earlier new package", async () => {
  const commands = [];
  await assert.rejects(
    publishPackages(
      [{ ...identity, name: "@lo-ink/new", cwd: "new" }, identity],
      {
        fetcher: async (url) =>
          url === tarball || url.includes("%2Fnew")
            ? response(404)
            : response(200, publicMetadata),
        execute: contentExecutor(commands, archive),
        wait: async () => {},
        verificationAttempts: 2,
        log: () => assert.fail("unavailable package reported success"),
      },
    ),
    /archive is not public yet; do not resend/,
  );
  assert.equal(commands.filter((args) => args[0] === "publish").length, 0);
});

test("matching SHA-512 metadata cannot hide corrupt or inaccessible public bytes", async () => {
  for (const existing of [false, true]) {
    for (const [download, pattern] of [
      [
        {
          status: 200,
          ok: true,
          arrayBuffer: async () => Buffer.from("corrupt"),
        },
        /archive integrity mismatch/,
      ],
      [response(503), /archive lookup failed: HTTP 503/],
    ]) {
      const commands = [];
      let lookups = 0;
      await assert.rejects(
        publishPackages([identity], {
          fetcher: async (url) =>
            url === tarball
              ? download
              : ++lookups === 1 && !existing
                ? response(404)
                : response(200, publicMetadata),
          execute: executor(commands),
          log: () => assert.fail("unverified package reported success"),
        }),
        pattern,
      );
      assert.equal(
        commands.filter((args) => args[0] === "publish").length,
        existing ? 0 : 1,
      );
    }
  }
});
