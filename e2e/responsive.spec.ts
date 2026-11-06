import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import {
  mockResponsiveApis,
  responsiveRoutes,
  scenarioFor,
  themes,
  viewports,
  type AuditRow,
} from "./responsive-audit";

const reportRoot = path.resolve("reports", "responsive");
const rawRoot = path.join(reportRoot, "raw");

function safeName(value: string) {
  return value.replaceAll("/", "_").replaceAll("?", "_").replaceAll(":", "_") || "home";
}

async function measureLayout(page: Page, route: string) {
  return page.evaluate((routePath) => {
    const width = document.documentElement.clientWidth;
    const root = document.scrollingElement ?? document.documentElement;
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
    const label = (element: Element) =>
      `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}.${typeof element.className === "string" ? element.className.split(/\s+/).slice(0, 2).join(".") : ""}`;
    const outside: string[] = [];
    const clipped: string[] = [];
    const longUnwrapped: string[] = [];
    const imagesOut: string[] = [];
    const inspectElement = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const text = element.children.length === 0 ? element.textContent.trim() : "";
      const isOutside = rect.left < -1 || rect.right > width + 1;
      const isClipped = /(hidden|clip)/.test(`${style.overflow} ${style.textOverflow}`) && element.scrollWidth > element.clientWidth + 1;
      const isLong = /[\p{L}\p{N}_-]{35,}/u.test(text) && style.overflowWrap !== "anywhere" && style.wordBreak !== "break-all" && style.whiteSpace !== "normal";
      inspectBounds({
        element,
        isOutside,
        label,
        results: outside,
        hasScroller: intentionalScroller,
      });
      inspectText({
        element,
        text,
        isClipped,
        isLong,
        label,
        clippedResults: clipped,
        longResults: longUnwrapped,
        hasScroller: intentionalScroller,
      });
      inspectImage(element, rect, label, imagesOut);
    };
    for (const element of [...document.body.querySelectorAll("*")].filter(visible))
      inspectElement(element);
    const logo = [...document.images].find((image) => /logo/i.test(image.alt));
    const logoOut = logo
      ? logo.getBoundingClientRect().right >
        (logo.parentElement?.getBoundingClientRect().right ?? width) + 1
      : false;
    return {
      pageScroll: root.scrollWidth <= width,
      elementBounds: outside.length === 0,
      textClipping: clipped.length === 0,
      longTextWrap: longUnwrapped.length === 0,
      imageBounds: imagesOut.length === 0 && !logoOut,
      printFit: routePath !== "/certificates/print" || root.scrollWidth <= width,
      outside,
      clipped,
      longUnwrapped,
      imagesOut,
    };

    function inspectBounds(input: {
      element: Element;
      isOutside: boolean;
      label: (element: Element) => string;
      results: string[];
      hasScroller: (element: Element) => boolean;
    }) {
      const { element, isOutside, label: getLabel, results, hasScroller } = input;
      if (isOutside && !hasScroller(element)) results.push(getLabel(element));
    }

    function inspectText(input: {
      element: Element;
      text: string;
      isClipped: boolean;
      isLong: boolean;
      label: (element: Element) => string;
      clippedResults: string[];
      longResults: string[];
      hasScroller: (element: Element) => boolean;
    }) {
      const {
        element,
        text,
        isClipped,
        isLong,
        label: getLabel,
        clippedResults,
        longResults,
        hasScroller,
      } = input;
      if (text && isClipped) clippedResults.push(getLabel(element));
      if (text && isLong && !hasScroller(element)) longResults.push(getLabel(element));
    }

    function inspectImage(
      element: Element,
      rect: DOMRect,
      getLabel: (element: Element) => string,
      results: string[],
    ) {
      if (!(element instanceof HTMLImageElement)) return;
      const parent = element.parentElement?.getBoundingClientRect();
      if (parent && (rect.width > parent.width + 1 || rect.height > parent.height + 1))
        results.push(getLabel(element));
    }
  }, route);
}

async function measureControls(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const elements = [...document.body.querySelectorAll("*")].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    const interactive = elements.filter((element) =>
      element.matches("button,a,input,select,textarea,[role=button]"),
    );
    const smallControls = interactive.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width < 44 || rect.height < 44
        ? [`${element.tagName.toLowerCase()}:${element.textContent.trim().slice(0, 24)}`]
        : [];
    });
    const overlaps: string[] = [];
    for (let left = 0; left < interactive.length; left += 1) {
      const first = interactive[left];
      if (!first) continue;
      const a = first.getBoundingClientRect();
      for (let right = left + 1; right < interactive.length; right += 1) {
        const second = interactive[right];
        if (!second || first.contains(second) || second.contains(first)) continue;
        const b = second.getBoundingClientRect();
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 2 && overlapY > 2)
          overlaps.push(`${first.tagName.toLowerCase()} / ${second.tagName.toLowerCase()}`);
      }
    }
    const buttonsCut = interactive.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > width + 1;
    }).length;
    return { smallControls, overlaps, buttonsCut };
  });
}

async function measureForms(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const forms = [...document.forms].filter(visible);
    const multiColumnForms = forms.filter((form) => {
      const columns = getComputedStyle(form).gridTemplateColumns;
      return innerWidth <= 430 && columns.split(" ").filter(Boolean).length > 1;
    }).length;
    const inputsUnder16 = [...document.querySelectorAll("input,select,textarea")]
      .filter(visible)
      .filter((input) => Number.parseFloat(getComputedStyle(input).fontSize) < 16).length;
    return { multiColumnForms, inputsUnder16 };
  });
}

async function measureModals(page: Page) {
  return page.evaluate(() => {
    const height = document.documentElement.clientHeight;
    const dialogs = [...document.querySelectorAll('[role="dialog"],dialog[open]')].filter(
      (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      },
    );
    const modalIssues = dialogs.flatMap((dialog) => {
      const rect = dialog.getBoundingClientRect();
      const close = dialog.querySelector(
        'button[aria-label*="close" i],button[aria-label*="cancel" i],[data-close]',
      );
      const closeRect = close?.getBoundingClientRect();
      const outside = rect.top < 0 || rect.bottom > height;
      const closeOutside = Boolean(closeRect && (closeRect.top < 0 || closeRect.bottom > height));
      return outside || closeOutside
        ? ["dialog exceeds viewport or close action is unreachable"]
        : [];
    });
    return { modalIssues };
  });
}

async function measureStyles(page: Page) {
  return page.evaluate(() => {
    const readRules = (rules: CSSRuleList): string[] =>
      [...rules].flatMap((rule) => {
        const nested = rule instanceof CSSGroupingRule ? rule.cssRules : null;
        return [rule.cssText, ...(nested ? readRules(nested) : [])];
      });
    const cssRules = [...document.styleSheets]
      .flatMap((sheet) => {
        try {
          return readRules(sheet.cssRules);
        } catch {
          return [];
        }
      })
      .join("\n");
    const tables = [...document.querySelectorAll("table")];
    const width = document.documentElement.clientWidth;
    const contained = tables.every((table) => {
      let parent = table.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1)
          return true;
        parent = parent.parentElement;
      }
      return table.getBoundingClientRect().width <= width + 1;
    });
    return {
      tableContainment: contained,
      scrollPadding:
        Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) > 0,
      viewportMeta: Boolean(document.querySelector('meta[name="viewport"]')),
      safeAreaSupport: cssRules.includes("safe-area-inset"),
      no100vh: !/(^|[^d])100vh\b/.test(cssRules),
      reducedMotion:
        matchMedia("(prefers-reduced-motion: reduce)").matches &&
        cssRules.includes("prefers-reduced-motion: reduce"),
    };
  });
}

async function measure(page: Page, route: string) {
  const [layout, controls, forms, modals, styles] = await Promise.all([
    measureLayout(page, route),
    measureControls(page),
    measureForms(page),
    measureModals(page),
    measureStyles(page),
  ]);
  const checks = {
    pageScroll: layout.pageScroll,
    elementBounds: layout.elementBounds,
    targetSize: controls.smallControls.length === 0,
    controlOverlap: controls.overlaps.length === 0,
    textClipping: layout.textClipping,
    longTextWrap: layout.longTextWrap,
    inputFont: forms.inputsUnder16 === 0,
    phoneFormColumns: forms.multiColumnForms === 0,
    buttonsVisible: controls.buttonsCut === 0,
    scrollPadding: styles.scrollPadding,
    modalFit: modals.modalIssues.length === 0,
    tableContainment: styles.tableContainment,
    imageBounds: layout.imageBounds,
    printFit: layout.printFit,
    viewportMeta: styles.viewportMeta,
    safeAreaSupport: styles.safeAreaSupport,
    no100vh: styles.no100vh,
    reducedMotion: styles.reducedMotion,
  };
  const failures = Object.entries(checks).flatMap(([name, passed]) => (passed ? [] : [name]));
  if (layout.outside.length) failures.push(`outside=${layout.outside.slice(0, 4).join(";")}`);
  if (controls.smallControls.length)
    failures.push(`under44=${controls.smallControls.slice(0, 4).join(";")}`);
  if (controls.overlaps.length) failures.push(`overlap=${controls.overlaps.slice(0, 3).join(";")}`);
  if (layout.clipped.length) failures.push(`clipped=${layout.clipped.slice(0, 4).join(";")}`);
  if (layout.longUnwrapped.length)
    failures.push(`longString=${layout.longUnwrapped.slice(0, 3).join(";")}`);
  if (forms.inputsUnder16) failures.push(`inputsUnder16=${String(forms.inputsUnder16)}`);
  if (forms.multiColumnForms) failures.push(`multiColumnForms=${String(forms.multiColumnForms)}`);
  failures.push(...modals.modalIssues);
  return { checks, failures };
}
async function navigateToPrivatePage(page: Page, route: string) {
  if (route !== "/certificates/results" && route !== "/certificates/print") {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    return;
  }
  await page.goto("/certificates", { waitUntil: "domcontentloaded" });
  await expect(page.locator('select[name="className"]')).toBeEnabled();
  await page.locator('input[name="studentName"]').fill("Rahul Kumar");
  await page.locator('input[name="fatherName"]').fill("Amit Kumar");
  await page.locator('input[name="motherName"]').fill("Sunita Kumar");
  await page.locator('select[name="className"]').selectOption("Class 10");
  await page.locator('input[name="scholarNumber"]').fill("1001");
  await page.locator('select[name="session"]').selectOption("2025-26");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Find My Certificates" }).click();
  await expect(page.getByRole("heading", { name: "Certificates found" })).toBeVisible();
  if (route === "/certificates/print") {
    await page.getByRole("link", { name: /Print all certificates/i }).click();
    await expect(page.locator("body")).toContainText(/Print|Certificate/i);
  }
}

for (const route of responsiveRoutes) {
  test(`responsive baseline ${route}`, async ({ page, browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Full screenshots and metric records are captured in Chromium.",
    );
    test.setTimeout(0);
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(15_000);
    const fixture = scenarioFor(route);
    const rows: AuditRow[] = [];
    await mockResponsiveApis(page, fixture);
    await mkdir(path.join(reportRoot, "screenshots", safeName(route)), { recursive: true });
    await mkdir(rawRoot, { recursive: true });
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
        const measured = await measure(page, route);
        rows.push({
          route,
          viewport: `${String(width)}x${String(height)}`,
          theme,
          fixture,
          ...measured,
        });
        await page.screenshot({
          path: path.join(
            reportRoot,
            "screenshots",
            safeName(route),
            `${String(width)}x${String(height)}-${theme}.png`,
          ),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    await writeFile(path.join(rawRoot, `${safeName(route)}.json`), JSON.stringify(rows, null, 2));
    const failed = rows.filter((row) => row.failures.length);
    expect(
      failed,
      `${route}: ${String(failed.length)} failing viewport/theme combinations`,
    ).toEqual([]);
  });
}

test("Hindi selector keeps a phone layout within 320 CSS pixels", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Hindi stress check runs in Chromium.");
  await mockResponsiveApis(page, "worst");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#language-toggle").selectOption("hi");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await page.setViewportSize({ width: 320, height: 568 });
  const dimensions = await page.evaluate(() => ({
    content: document.scrollingElement?.scrollWidth ?? 0,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await page.screenshot({ path: path.join(reportRoot, "stress-hindi-320.png"), fullPage: true });
});

test("responsive stress: 200% text and 200/400% zoom reflow to 320 CSS pixels", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Zoom stress check runs in Chromium.");
  await mockResponsiveApis(page, "worst");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/admin/students");
  for (const zoom of [2, 4]) {
    await page.evaluate((value) => {
      document.documentElement.style.zoom = `${String(value * 100)}%`;
      document.documentElement.style.fontSize = "200%";
    }, zoom);
    const widths = await page.evaluate(
      (value) => ({
        effectiveContent: (document.scrollingElement?.scrollWidth ?? 0) / value,
        effectiveViewport: document.documentElement.clientWidth / value,
      }),
      zoom,
    );
    expect(widths.effectiveContent).toBeLessThanOrEqual(widths.effectiveViewport + 1);
    await page.screenshot({
      path: path.join(reportRoot, `stress-${String(zoom * 100)}-text200.png`),
      fullPage: true,
    });
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
          content: document.scrollingElement?.scrollWidth ?? 0,
          viewport: document.documentElement.clientWidth,
        }));
        expect(
          dimensions.content,
          `${route} ${String(width)}x${String(height)} ${theme}`,
        ).toBeLessThanOrEqual(dimensions.viewport);
      }
    }
  }
});
