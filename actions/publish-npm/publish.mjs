import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const registry = "https://registry.npmjs.org";

function archiveContents(archive) {
  // Read tar entries without extracting registry-controlled paths or links.
  const run = (args, encoding) =>
    execFileSync("tar", args, {
      encoding,
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  const paths = run(["-tf", archive], "utf8").trimEnd().split("\n");
  const modes = run(["-tvf", archive], "utf8").trimEnd().split("\n");
  if (paths.length !== modes.length)
    throw new Error("Invalid package archive listing");
  const entries = new Map();
  for (const [index, path] of paths.entries()) {
    if (
      !path.startsWith("package/") ||
      // eslint-disable-next-line no-control-regex -- Archive member names cannot contain control bytes.
      /[\\\r\u0000]/.test(path) ||
      path.split("/").some((part) => part === "." || part === "..")
    )
      throw new Error("Invalid package archive path");
    const mode = modes[index].slice(0, 10);
    if (mode.startsWith("d") && path.endsWith("/")) continue;
    if (!mode.startsWith("-") || entries.has(path))
      throw new Error("Package archives must contain unique regular files");
    const content = run(["-xOf", archive, "--", path]);
    entries.set(
      path,
      `${mode}:${createHash("sha256").update(content).digest("hex")}`,
    );
  }
  if (!entries.has("package/package.json"))
    throw new Error("Package archive has no manifest");
  return entries;
}

async function verifyPublishedContents(
  pkg,
  metadata,
  archive,
  integrity,
  destination,
  fetcher,
) {
  const publishedIntegrity = metadata.dist?.integrity;
  if (
    typeof publishedIntegrity !== "string" ||
    !publishedIntegrity.startsWith("sha512-")
  )
    throw new Error("Published package has no SHA-512 integrity");
  if (publishedIntegrity === integrity) return;
  const tarball = new URL(metadata.dist?.tarball);
  if (
    tarball.origin !== registry ||
    tarball.username ||
    tarball.password ||
    tarball.hash
  )
    throw new Error("Unexpected published package archive URL");
  const response = await fetcher(tarball.href, {
    signal: AbortSignal.timeout(30_000),
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(`Registry archive lookup failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (
    `sha512-${createHash("sha512").update(bytes).digest("base64")}` !==
    publishedIntegrity
  )
    throw new Error("Published archive integrity mismatch");
  const publishedArchive = join(destination, "published.tgz");
  writeFileSync(publishedArchive, bytes);
  const actual = archiveContents(archive),
    published = archiveContents(publishedArchive);
  if (
    actual.size !== published.size ||
    [...actual].some(([path, digest]) => published.get(path) !== digest)
  )
    throw new Error(
      `${pkg.name}@${pkg.version}: source differs from the published package; bump its version before publishing dependents`,
    );
}

export function readPackages(root, directories, repository) {
  if (!Array.isArray(directories) || directories.length === 0) {
    throw new Error("Provide at least one package directory");
  }
  const packages = directories.map((directory) => {
    if (typeof directory !== "string" || isAbsolute(directory)) {
      throw new Error("Package directories must be relative paths");
    }
    const cwd = realpathSync(resolve(root, directory));
    const inside = relative(realpathSync(root), cwd);
    if (inside === ".." || inside.startsWith("../")) {
      throw new Error("Package directory escapes the repository");
    }
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
    if (pkg.private || !/^@lo-ink\/[a-z0-9][a-z0-9-]*$/.test(pkg.name)) {
      throw new Error("Only public @lo-ink packages can be published");
    }
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) {
      throw new Error(`Invalid release version for ${pkg.name}`);
    }
    const url = pkg.repository?.url
      ?.replace(/^git\+/, "")
      .replace(/\.git$/, "");
    if (url !== `https://github.com/${repository}`) {
      throw new Error(`Repository metadata does not match ${pkg.name}`);
    }
    return { ...pkg, cwd };
  });
  if (new Set(packages.map((pkg) => pkg.name)).size !== packages.length) {
    throw new Error("Package list contains duplicates");
  }
  const seen = new Set();
  for (const pkg of packages) {
    for (const dependency of Object.keys(pkg.dependencies ?? {})) {
      if (
        packages.some((other) => other.name === dependency) &&
        !seen.has(dependency)
      ) {
        throw new Error(`Publish ${dependency} before ${pkg.name}`);
      }
    }
    seen.add(pkg.name);
  }
  return packages;
}

export async function publishedVersion(pkg, fetcher = fetch) {
  const response = await fetcher(
    `${registry}/${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Registry lookup failed: HTTP ${response.status}`);
  const metadata = await response.json();
  if (metadata.name !== pkg.name || metadata.version !== pkg.version) {
    throw new Error("Registry returned unexpected package identity");
  }
  return metadata;
}

export async function publishPackages(
  packages,
  {
    fetcher = fetch,
    execute = execFileSync,
    log = console.log,
    wait = (ms) => new Promise((done) => setTimeout(done, ms)),
    verificationAttempts = 180,
  } = {},
) {
  // npm ci links local workspaces, including versions already in the registry.
  // Build dependencies before packing any remaining unpublished dependent.
  for (const pkg of packages) {
    execute("npm", ["run", "prepack", "--if-present"], {
      cwd: pkg.cwd,
      stdio: "inherit",
    });
  }
  const results = [],
    prepared = [],
    destinations = [];
  try {
    // Verify the whole release before its first upload, including unchanged versions.
    for (const pkg of packages) {
      const existing = await publishedVersion(pkg, fetcher);
      const destination = mkdtempSync(join(tmpdir(), "lo-npm-release-"));
      destinations.push(destination);
      const packed = JSON.parse(
        execute(
          "npm",
          [
            "pack",
            "--json",
            "--ignore-scripts",
            "--pack-destination",
            destination,
          ],
          {
            cwd: pkg.cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "inherit"],
          },
        ),
      );
      if (
        packed.length !== 1 ||
        packed[0].name !== pkg.name ||
        packed[0].version !== pkg.version ||
        !/^[a-z0-9][a-z0-9._-]*\.tgz$/.test(packed[0].filename)
      ) {
        throw new Error("Packed archive does not match the release package");
      }
      const archive = join(destination, packed[0].filename);
      const integrity = `sha512-${createHash("sha512").update(readFileSync(archive)).digest("base64")}`;
      if (packed[0].integrity !== integrity)
        throw new Error("Packed archive integrity mismatch");
      if (existing)
        await verifyPublishedContents(
          pkg,
          existing,
          archive,
          integrity,
          destination,
          fetcher,
        );
      prepared.push({ pkg, existing, archive, integrity });
    }
    for (const { pkg, existing, archive, integrity } of prepared) {
      if (existing) {
        log(`${pkg.name}@${pkg.version}: already published; contents verified`);
        results.push({
          name: pkg.name,
          version: pkg.version,
          status: "already published",
          integrity: existing.dist.integrity,
        });
        continue;
      }
      execute(
        "npm",
        [
          "publish",
          archive,
          "--registry",
          registry,
          "--access",
          "public",
          "--tag",
          pkg.version.includes("-") ? "next" : "latest",
        ],
        {
          cwd: pkg.cwd,
          stdio: "inherit",
        },
      );
      let metadata;
      for (let attempt = 0; attempt < verificationAttempts; attempt++) {
        metadata = await publishedVersion(pkg, fetcher);
        if (metadata) break;
        if (attempt + 1 < verificationAttempts) await wait(10_000);
      }
      if (!metadata) {
        throw new Error(
          "Registry accepted the upload but the version is not public yet; do not resend the archive while processing continues",
        );
      }
      if (metadata.dist?.integrity !== integrity)
        throw new Error(
          "Public registry integrity does not match the uploaded archive",
        );
      log(`${pkg.name}@${pkg.version}: published and verified`);
      results.push({
        name: pkg.name,
        version: pkg.version,
        status: "published",
        integrity,
      });
    }
  } finally {
    for (const destination of destinations)
      rmSync(destination, { recursive: true, force: true });
  }
  return results;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (
    !["push", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME) ||
    process.env.GITHUB_REF !== "refs/heads/main" ||
    !process.env.ACTIONS_ID_TOKEN_REQUEST_URL ||
    !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  ) {
    throw new Error(
      "Publishing requires a main-branch GitHub Actions run with OIDC permission",
    );
  }
  const packages = readPackages(
    process.cwd(),
    JSON.parse(process.env.LO_RELEASE_PACKAGE_PATHS),
    process.env.GITHUB_REPOSITORY,
  );
  await publishPackages(packages);
}
