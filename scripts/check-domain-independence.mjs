#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(
  process.env.DOMAIN_INDEPENDENCE_ROOT ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
);
const roots = ["src", "app", "config/school.ts", "public", "vercel.json", "next.config.ts"];
const officialWebsiteConfig = "config/school.ts";
const allowedHostRoots = [
  "google.com",
  "googleapis.com",
  "gstatic.com",
  "googleusercontent.com",
  "recaptcha.net",
  "firebaseapp.com",
  "firebaseio.com",
  "web.app",
  "cloudflare.com",
  "cloudflarestorage.com",
  "gmail.com",
  "sentry.io",
  "plausible.io",
  "vercel.com",
  "vercel.app",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "x.com",
  "wa.me",
  "sischool.in",
];
const licenseFiles = new Set(["public/fonts/OFL-NotoSansDevanagari.txt"]);

function isAllowedHost(host) {
  return allowedHostRoots.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function readHost(content, start) {
  let end = start;
  while (end < content.length) {
    const character = content.charCodeAt(end);
    const isHostCharacter =
      (character >= 48 && character <= 57) ||
      (character >= 65 && character <= 90) ||
      (character >= 97 && character <= 122) ||
      character === 45 ||
      character === 46;
    if (!isHostCharacter) break;
    end += 1;
  }
  return { host: content.slice(start, end).toLowerCase(), end };
}

function findUnapprovedHosts(file, content) {
  const violations = [];
  let urlStart = content.indexOf("https://");
  while (urlStart !== -1) {
    const { host, end } = readHost(content, urlStart + "https://".length);
    if (host && !isAllowedHost(host)) {
      const line = content.slice(0, urlStart).split("\n").length;
      violations.push({
        file,
        line,
        reason: `hard-coded HTTPS host "${host}" is not on the third-party allowlist`,
      });
    }
    urlStart = content.indexOf("https://", end);
  }
  return violations;
}

export function findDomainIndependenceViolations(file, content) {
  const normalizedPath = file.replaceAll("\\", "/");
  const violations = [];
  const lowered = content.toLowerCase();
  const containsConfiguredOfficialWebsite =
    normalizedPath === officialWebsiteConfig &&
    /export\s+const\s+OFFICIAL_WEBSITE\s*=\s*["']https:\/\/sischool\.in["'];/i.test(content);
  if (lowered.includes("sischool.in") && !containsConfiguredOfficialWebsite)
    violations.push({ file: normalizedPath, reason: "contains the retired sischool.in domain" });
  if (lowered.includes("example.org"))
    violations.push({ file: normalizedPath, reason: "contains an example.org fallback" });
  if (!licenseFiles.has(normalizedPath))
    violations.push(...findUnapprovedHosts(normalizedPath, content));
  return violations;
}

async function collectFiles(relativePath) {
  const absolutePath = path.join(root, relativePath);
  let metadata;
  try {
    metadata = await stat(absolutePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }

  if (metadata.isFile()) return [relativePath];
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(child)));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

export async function scanDomainIndependence() {
  const files = (await Promise.all(roots.map(collectFiles))).flat();
  const results = await Promise.all(
    files.map(async (file) => {
      const content = await readFile(path.join(root, file));
      if (content.includes(0)) return [];
      return findDomainIndependenceViolations(file, content.toString("utf8"));
    }),
  );
  return results.flat();
}

async function main() {
  const violations = await scanDomainIndependence();
  if (violations.length) {
    for (const violation of violations) {
      const location = violation.line
        ? `${violation.file}:${String(violation.line)}`
        : violation.file;
      process.stderr.write(`FAIL ${location}: ${violation.reason}\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Domain independence check passed.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
