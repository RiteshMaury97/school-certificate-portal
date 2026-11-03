import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  mockResponsiveApis,
  responsiveRoutes,
  scenarioFor,
  themes,
  viewports,
  type Theme,
} from "./responsive-audit";

type AuditRow = {
  route: string;
  viewport: string;
  theme: Theme;
  fixture: string;
  checks: Record<string, boolean | null>;
  failures: string[];
};

const reportRoot = path.resolve("reports", "responsive");

function safeName(value: string) {
  return value.replaceAll("/", "_").replaceAll("?", "_").replaceAll(":", "_") || "home";
}

async function measure(page: import("@playwright/test").Page, route: string) {
  return page.evaluate((routePath) => {
    const root = document.scrollingElement ?? document.documentElement;
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const intentionalScroller = (element: Element) => {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1) return true;
        parent = parent.parentElement;
      }
      return false;
    };
    const elements = [...document.body.querySelectorAll("*")].filter(visible);
    const outside: string[] = [];
    const clipped: string[] = [];
    const longUnwrapped: string[] = [];
    const imagesOut: string[] = [];
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const label = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}.${typeof element.className === "string" ? element.className.split(/\s+/).slice(0, 2).join(".") : ""}`;
      if (!intentionalScroller(element) && (rect.left < -1 || rect.right > width + 1)) outside.push(label);
      const style = getComputedStyle(element);
      const text = element.children.length === 0 ? element.textContent?.trim() ?? "" : "";
      if (text && /(hidden|clip)/.test(`${style.overflow} ${style.textOverflow}`) && element.scrollWidth > element.clientWidth + 1) clipped.push(label);
      if (text && /[\p{L}\p{N}_-]{35,}/u.test(text) && style.overflowWrap !== "anywhere" && style.wordBreak !== "break-all" && style.whiteSpace !== "normal" && !intentionalScroller(element)) longUnwrapped.push(label);
      if (element instanceof HTMLImageElement && (rect.width > element.parentElement?.getBoundingClientRect().width! + 1 || rect.height > element.parentElement?.getBoundingClientRect().height! + 1)) imagesOut.push(label);
    }
    const interactive = elements.filter((element) => element.matches("button,a,input,select,textarea,[role=button]"));
    const smallControls = interactive.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width < 44 || rect.height < 44 ? [`${element.tagName.toLowerCase()}:${(element.textContent ?? "").trim().slice(0, 24)}`] : [];
    });
    const overlaps: string[] = [];
    for (let left = 0; left < interactive.length; left += 1) {
      const a = interactive[left].getBoundingClientRect();
      for (let right = left + 1; right < interactive.length; right += 1) {
        const first = interactive[left];
        const second = interactive[right];
        if (first.contains(second) || second.contains(first)) continue;
        const b = second.getBoundingClientRect();
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2)
          overlaps.push(`${first.tagName.toLowerCase()} / ${second.tagName.toLowerCase()}`);
      }
    }
    const forms = [...document.forms].filter(visible);
    const multiColumnForms = forms.filter((form) => {
      const columns = getComputedStyle(form).gridTemplateColumns;
      return innerWidth <= 430 && columns.split(" ").filter(Boolean).length > 1;
    }).length;
    const inputsUnder16 = [...document.querySelectorAll("input,select,textarea")].filter(visible).filter((input) => Number.parseFloat(getComputedStyle(input).fontSize) < 16).length;
    const buttonsCut = interactive.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > width + 1;
    }).length;
    const dialogs = [...document.querySelectorAll('[role="dialog"],dialog[open]')].filter(visible);
    const modalIssues = dialogs.flatMap((dialog) => {
      const rect = dialog.getBoundingClientRect();
      const close = dialog.querySelector('button[aria-label*="close" i],button[aria-label*="cancel" i],[data-close]');
      const closeRect = close?.getBoundingClientRect();
      return rect.top < 0 || rect.bottom > height || (closeRect && (closeRect.top < 0 || closeRect.bottom > height)) ? ["dialog exceeds viewport or close action is unreachable"] : [];
    });
    const tables = [...document.querySelectorAll("table")].filter(visible);
    const uncontainedTables = tables.filter((table) => !intentionalScroller(table) && table.getBoundingClientRect().width > width + 1).length;
    const logo = [...document.images].find((image) => /logo/i.test(image.alt));
    const logoOut = logo ? logo.getBoundingClientRect().right > (logo.parentElement?.getBoundingClientRect().right ?? width) + 1 : false;
    const hasViewportMeta = Boolean(document.querySelector('meta[name="viewport"]'));
    const safeAreaReferenced = [...document.styleSheets].some((sheet) => {
      try { return [...sheet.cssRules].some((rule) => rule.cssText.includes("safe-area-inset")); }
      catch { return false; }
    });
    const vhUsage = [...document.styleSheets].some((sheet) => {
      try { return [...sheet.cssRules].some((rule) => /(^|[^d])100vh\b/.test(rule.cssText)); }
      catch { return false; }
    });
    const paddingTop = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
    const printOverflow = routePath === "/certificates/print" && root.scrollWidth > width + 1;
    const failures: string[] = [];
    const checks = {
      pageScroll: root.scrollWidth <= width,
      elementBounds: outside.length === 0,
      targetSize: smallControls.length === 0,
      controlOverlap: overlaps.length === 0,
      textClipping: clipped.length === 0,
      longTextWrap: longUnwrapped.length === 0,
      inputFont: inputsUnder16 === 0,
      phoneFormColumns: multiColumnForms === 0,
      buttonsVisible: buttonsCut === 0,
      scrollPadding: paddingTop > 0,
      modalFit: modalIssues.length === 0,
      tableContainment: uncontainedTables === 0,
      imageBounds: imagesOut.length === 0 && !logoOut,
      printFit: !printOverflow,
      viewportMeta: hasViewportMeta,
      safeAreaSupport: safeAreaReferenced,
      no100vh: !vhUsage,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
    for (const [name, passed] of Object.entries(checks)) if (!passed) failures.push(name);
    if (outside.length) failures.push(`outside=${outside.slice(0, 4).join(";")}`);
    if (smallControls.length) failures.push(`under44=${smallControls.slice(0, 4).join(";")}`);
    if (overlaps.length) failures.push(`overlap=${overlaps.slice(0, 3).join(";")}`);
    if (clipped.length) failures.push(`clipped=${clipped.slice(0, 4).join(";")}`);
    if (longUnwrapped.length) failures.push(`longString=${longUnwrapped.slice(0, 3).join(";")}`);
    if (modalIssues.length) failures.push(...modalIssues);
    return { checks, failures };
  }, route);
}

async function navigateToPrivatePage(page: import("@playwright/test").Page, route: string) {
  if (route !== "/certificates/results" && route !== "/certificates/print") {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    return;
  }
  await page.goto("/certificates", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="studentName"]').fill("Rahul Kumar");
  await page.locator('input[name="fatherName"]').fill("Amit Kumar");
  await page.locator('input[name="motherName"]').fill("Sunita Kumar");
  await page.locator('select[name="className"]').selectOption("Class 10");
  await page.locator('input[name="scholarNumber"]').fill("1001");
  await page.locator('select[name="session"]').selectOption("2025-26");
  await page.locator('input[name="consent"]').check();
  await page.getByRole("button", { name: "Find My Certificates" }).click();
  await page.waitForURL("**/certificates/results");
  if (route === "/certificates/print") {
    await page.getByRole("link", { name: /Print all certificates/i }).click();
    await page.waitForURL("**/certificates/print");
  }
}

function matrixCell(rows: AuditRow[], route: string, viewport: string) {
  const entries = rows.filter((row) => row.route === route && row.viewport === viewport);
  return ["light", "dark", "contrast"].map((theme) => {
    const row = entries.find((entry) => entry.theme === theme);
    return `${theme[0]?.toUpperCase() ?? "?"}:${row?.failures.length ? "FAIL" : "PASS"}`;
  }).join(" ");
}

function summaryMarkdown(rows: AuditRow[], baselineDate: string) {
  const labels = viewports.map(([width, height]) => `${width}×${height}`);
  const header = `| Route | Fixture | ${labels.join(" | ")} |`;
  const separator = `|---|---|${labels.map(() => "---").join("|")}|`;
  const table = responsiveRoutes.map((route) => {
    const fixture = scenarioFor(route);
    const cells = viewports.map(([width, height]) => matrixCell(rows, route, `${width}x${height}`));
    return `| ${route} | ${fixture} | ${cells.join(" | ")} |`;
  });
  const failedRows = rows.filter((row) => row.failures.length);
  const failedChecks = new Map<string, number>();
  for (const row of failedRows) for (const failure of row.failures) {
    const check = failure.split("=")[0];
    failedChecks.set(check, (failedChecks.get(check) ?? 0) + 1);
  }
  const details = failedChecks.size
    ? [...failedChecks].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => `- ${name}: ${String(count)} failing combinations`).join("\n")
    : "No failing checks.";
  return `# Responsive audit baseline\n\n- Captured: ${baselineDate}\n- Browser: Chromium via Playwright\n- Combinations: ${String(rows.length)} (route × viewport × theme)\n- Passing combinations: ${String(rows.length - failedRows.length)}\n- Failing combinations: ${String(failedRows.length)}\n- Screenshots: reports/responsive/screenshots/\n\nEach viewport cell lists Light, Dark and High Contrast status (L/D/C).\n\n${header}\n${separator}\n${table.join("\n")}\n\n## Failed checks\n\n${details}\n\n## Raw records\n\nSee matrix.json for individual check results and failure details.\n`;
}

test("responsive baseline: every page, viewport and theme", async ({ page, browserName }) => {
  test.setTimeout(0);
  test.skip(browserName !== "chromium", "The baseline screenshot set is captured in Chromium.");
  const rows: AuditRow[] = [];
  await mkdir(path.join(reportRoot, "screenshots"), { recursive: true });
  for (const route of responsiveRoutes) {
    const fixture = scenarioFor(route);
    await mockResponsiveApis(page, fixture);
    await page.setViewportSize({ width: 1280, height: 800 });
    await navigateToPrivatePage(page, route);
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      for (const theme of themes) {
        await page.emulateMedia({
          colorScheme: theme === "dark" ? "dark" : "light",
          forcedColors: theme === "contrast" ? "active" : "none",
          reducedMotion: "reduce",
        });
        await page.evaluate((activeTheme) => {
          document.documentElement.dataset.theme = activeTheme === "dark" ? "dark" : "light";
        }, theme);
        if (theme === "contrast") {
          await page.evaluate(() => {
            if (location.pathname.startsWith("/admin")) return;
            localStorage.setItem("sis-locale", "hi");
            window.dispatchEvent(new Event("sis-locale-change"));
          });
          await page.waitForFunction(() => location.pathname.startsWith("/admin") || document.documentElement.lang === "hi");
        }
        const measured = await measure(page, route);
        rows.push({ route, viewport: `${width}x${height}`, theme, fixture, ...measured });
        const screenshotPath = path.join(reportRoot, "screenshots", safeName(route));
        await mkdir(screenshotPath, { recursive: true });
        await page.screenshot({
          path: path.join(screenshotPath, `${String(width)}x${String(height)}-${theme}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  }
  const capturedAt = new Date().toISOString();
  await writeFile(path.join(reportRoot, "matrix.json"), JSON.stringify(rows, null, 2));
  await writeFile(path.join(reportRoot, "summary.md"), summaryMarkdown(rows, capturedAt));
  const failed = rows.filter((row) => row.failures.length);
  expect(failed, `${String(failed.length)} responsive combinations failed; see reports/responsive/summary.md`).toEqual([]);
});

test("responsive stress: 200% text and 200/400% zoom reflow to 320 CSS pixels", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium is the required baseline engine.");
  test.setTimeout(120_000);
  await mockResponsiveApis(page, "worst");
  for (const zoom of [2, 4]) {
    await page.setViewportSize({ width: 320 * zoom, height: 568 * zoom });
    await page.goto("/admin/students");
    await page.evaluate((value) => {
      document.documentElement.style.zoom = `${String(value * 100)}%`;
      document.documentElement.style.fontSize = "200%";
    }, zoom);
    const widths = await page.evaluate((value) => ({
      effectiveContent: document.scrollingElement!.scrollWidth / value,
      effectiveViewport: document.documentElement.clientWidth,
    }), zoom);
    expect(widths.effectiveContent).toBeLessThanOrEqual(widths.effectiveViewport + 1);
    await page.screenshot({ path: path.join(reportRoot, `stress-${String(zoom * 100)}-text200.png`), fullPage: true });
  }
});

test("WebKit responsive smoke: every route, viewport and theme", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit", "Runs only in the installed WebKit project.");
  test.setTimeout(0);
  for (const route of responsiveRoutes) {
    await mockResponsiveApis(page, scenarioFor(route));
    await page.setViewportSize({ width: 1280, height: 800 });
    await navigateToPrivatePage(page, route);
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      for (const theme of themes) {
        await page.emulateMedia({
          colorScheme: theme === "dark" ? "dark" : "light",
          forcedColors: theme === "contrast" ? "active" : "none",
        });
        const dimensions = await page.evaluate(() => ({
          content: document.scrollingElement?.scrollWidth ?? document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        }));
        expect(dimensions.content, `${route} ${width}x${height} ${theme}`).toBeLessThanOrEqual(dimensions.viewport);
      }
    }
  }
});
