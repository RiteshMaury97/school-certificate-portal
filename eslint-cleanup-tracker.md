# ESLint cleanup tracker

Saved full-repository report: 373 errors and 2 warnings. Rows marked [x] were confirmed by targeted ESLint checks or resolved by the source fix. The saved report predates those targeted fixes, so use the checkboxes to distinguish resolved rows; no new full-repository lint run has been made.

## Easy (44)

| Done | File:line | Rule | Severity | Diagnostic |
|---|---|---|---|---|
| [x] | `e2e/responsive-teardown.ts:17` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "320 \| 360 \| 375 \| 667 \| 390 \| 844 \| 412 \| 430 \| 768 \| 1024 \| 820 \| 1280 \| 1440 \| 1920 \| 2560" of template literal expression. |
| [x] | `e2e/responsive-teardown.ts:17` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "568 \| 640 \| 375 \| 667 \| 390 \| 844 \| 915 \| 932 \| 768 \| 1024 \| 1180 \| 800 \| 1440 \| 900 \| 1080" of template literal expression. |
| [x] | `e2e/responsive.spec.ts:191` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "320 \| 360 \| 375 \| 667 \| 390 \| 844 \| 412 \| 430 \| 768 \| 1024 \| 820 \| 1280 \| 1440 \| 1920 \| 2560" of template literal expression. |
| [x] | `e2e/responsive.spec.ts:191` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "568 \| 640 \| 375 \| 667 \| 390 \| 844 \| 915 \| 932 \| 768 \| 1024 \| 1180 \| 800 \| 1440 \| 900 \| 1080" of template literal expression. |
| [x] | `e2e/responsive.spec.ts:249` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "320 \| 360 \| 375 \| 667 \| 390 \| 844 \| 412 \| 430 \| 768 \| 1024 \| 820 \| 1280 \| 1440 \| 1920 \| 2560" of template literal expression. |
| [x] | `e2e/responsive.spec.ts:249` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "568 \| 640 \| 375 \| 667 \| 390 \| 844 \| 915 \| 932 \| 768 \| 1024 \| 1180 \| 800 \| 1440 \| 900 \| 1080" of template literal expression. |
| [x] | `src/app/api/admin/bulk-upload/preview/route.ts:92` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "500" of template literal expression. |
| [x] | `src/app/api/admin/login-check/route.ts:26` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/app/api/admin/login-check/route.ts:59` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/app/api/admin/otp/send/route.ts:134` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/app/api/admin/otp/send/route.ts:137` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/app/api/admin/students/import/route.ts:176` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "500" of template literal expression. |
| [x] | `src/app/api/admin/students/import/route.ts:190` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "string \| undefined" of template literal expression. |
| [x] | `src/app/api/admin/students/import/route.ts:195` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "string \| undefined" of template literal expression. |
| [x] | `src/app/api/admin/students/import/route.ts:201` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "string \| undefined" of template literal expression. |
| [x] | `src/app/api/admin/students/import/route.ts:205` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/app/api/admin/students/import/route.ts:241` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/app/api/admin/students/import/route.ts:411` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/app/api/admin/students/import/route.ts:427` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/app/api/admin/students/import/route.ts:433` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/app/api/admin/templates/route.ts:122` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/app/api/admin/templates/route.ts:136` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/app/api/certificates/verify/route.ts:98` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "string \| undefined" of template literal expression. |
| [x] | `src/app/api/public/feedback/route.ts:52` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/features/admin/components/certificates/CertificatesTab.tsx:395` | `@typescript-eslint/prefer-nullish-coalescing` | error | Prefer using nullish coalescing operator (`??`) instead of a logical or (`\|\|`), as it is a safer operator. |
| [x] | `src/features/admin/components/profile/ProfileTab.tsx:353` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/features/admin/components/site/BrandingTab.tsx:395` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/features/admin/components/students/StudentImportPanel.tsx:256` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/features/auth/CodeSteps.tsx:32` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/features/certificates/ResultsView.tsx:59` | `@typescript-eslint/prefer-nullish-coalescing` | error | Prefer using nullish coalescing operator (`??`) instead of a logical or (`\|\|`), as it is a safer operator. |
| [x] | `src/features/faq/FaqView.tsx:198` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/features/faq/FaqView.tsx:219` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/features/faq/FaqView.tsx:223` | `@typescript-eslint/prefer-nullish-coalescing` | error | Prefer using nullish coalescing operator (`??`) instead of a logical or (`\|\|`), as it is a safer operator. |
| [x] | `src/features/faq/FaqView.tsx:232` | `@typescript-eslint/prefer-nullish-coalescing` | error | Prefer using nullish coalescing operator (`??`) instead of a logical or (`\|\|`), as it is a safer operator. |
| [x] | `src/features/legal/TermsView.tsx:8` | `@typescript-eslint/prefer-nullish-coalescing` | error | Prefer using nullish coalescing operator (`??`) instead of a logical or (`\|\|`), as it is a safer operator. |
| [x] | `src/features/legal/TermsView.tsx:12` | `@typescript-eslint/prefer-nullish-coalescing` | error | Prefer using nullish coalescing operator (`??`) instead of a logical or (`\|\|`), as it is a safer operator. |
| [x] | `src/features/legal/TermsView.tsx:13` | `@typescript-eslint/prefer-nullish-coalescing` | error | Prefer using nullish coalescing operator (`??`) instead of a logical or (`\|\|`), as it is a safer operator. |
| [x] | `src/features/legal/TermsView.tsx:14` | `@typescript-eslint/prefer-nullish-coalescing` | error | Prefer using nullish coalescing operator (`??`) instead of a logical or (`\|\|`), as it is a safer operator. |
| [x] | `src/features/legal/TermsView.tsx:15` | `@typescript-eslint/prefer-nullish-coalescing` | error | Prefer using nullish coalescing operator (`??`) instead of a logical or (`\|\|`), as it is a safer operator. |
| [x] | `src/features/site-map/SiteMapView.tsx:85` | `@typescript-eslint/restrict-template-expressions` | error | Invalid type "number" of template literal expression. |
| [x] | `src/features/verify/VerifyView.tsx:151` | `@typescript-eslint/prefer-nullish-coalescing` | error | Prefer using nullish coalescing operator (`??`) instead of a logical or (`\|\|`), as it is a safer operator. |
| [x] | `src/server/env.ts:134` | `@typescript-eslint/prefer-nullish-coalescing` | error | Prefer using nullish coalescing operator (`??`) instead of a logical or (`\|\|`), as it is a safer operator. |
| [x] | `src/server/mailer.ts:116` | `@typescript-eslint/prefer-nullish-coalescing` | error | Prefer using nullish coalescing operator (`??`) instead of a logical or (`\|\|`), as it is a safer operator. |
| [x] | `src/shared/breach-drafts.ts:17` | `@typescript-eslint/prefer-nullish-coalescing` | error | Prefer using nullish coalescing operator (`??`) instead of a ternary expression, as it is simpler to read. |

## Medium (75)

| Done | File:line | Rule | Severity | Diagnostic |
|---|---|---|---|---|
| [x] | `e2e/responsive.spec.ts:51` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `e2e/responsive.spec.ts:51` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary optional chain on a non-nullish value. |
| [x] | `e2e/responsive.spec.ts:62` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/app/api/admin/bulk-upload/preview/route.ts:108` | `@typescript-eslint/prefer-optional-chain` | error | Prefer using an optional chain expression instead, as it's more concise and easier to read. |
| [x] | `src/app/api/admin/students/import/route.ts:244` | `@typescript-eslint/prefer-optional-chain` | error | Prefer using an optional chain expression instead, as it's more concise and easier to read. |
| [x] | `src/app/api/certificates/search/route.ts:285` | `@typescript-eslint/return-await` | error | Returning an awaited promise is required in this context. |
| [x] | `src/app/api/certificates/search/route.ts:350` | `@typescript-eslint/return-await` | error | Returning an awaited promise is required in this context. |
| [x] | `src/app/api/public/certificates/[id]/route.ts:5` | `@typescript-eslint/require-await` | error | Async function 'GET' has no 'await' expression. |
| [x] | `src/app/api/public/search/route.ts:5` | `@typescript-eslint/require-await` | error | Async function 'POST' has no 'await' expression. |
| [x] | `src/app/layout.tsx:90` | `react/no-danger` | error | Dangerous property 'dangerouslySetInnerHTML' found |
| [x] | `src/components/forms/useFormValidation.ts:9` | `@typescript-eslint/no-unnecessary-type-parameters` | error | Type parameter T is used only once in the function signature. |
| [x] | `$1` | `@next/next/no-img-element` | warning | Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element |
| [x] | `src/features/admin/components/catalog/CatalogTab.tsx:94` | `react-hooks/rules-of-hooks` | error | React Hook "useMemo" is called conditionally. React Hooks must be called in the exact same order in every component render. |
| [x] | `src/features/admin/components/catalog/CatalogTab.tsx:100` | `react-hooks/rules-of-hooks` | error | React Hook "useEffect" is called conditionally. React Hooks must be called in the exact same order in every component render. Did you accidentally call a React Hook after an early return? |
| [x] | `src/features/admin/components/catalog/CatalogTab.tsx:101` | `react-hooks/set-state-in-effect` | error | Error: Calling setState synchronously within an effect can trigger cascading renders  Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following: * Update external systems with the latest state from React. * Subscribe for updates from some external system, calling setState in a callback function when external state changes.  Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).  C:\Users\rites\Desktop\school-certificate-portal-release\src\features\admin\components\catalog\CatalogTab.tsx:101:5    99 \|   100 \|   useEffect(() => { > 101 \|     setPage((current) => Math.min(current, pageCount - 1));       \|     ^^^^^^^ Avoid calling setState() directly within an effect   102 \|   }, [pageCount]);   103 \|   104 \|   function changeSection(kind: CatalogKind) { |
| [x] | `src/features/admin/components/certificates/CertificatesTab.tsx:431` | `@typescript-eslint/no-floating-promises` | error | Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator. |
| [x] | `src/features/admin/components/certificates/CertificatesTab.tsx:469` | `@typescript-eslint/no-floating-promises` | error | Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator. |
| [x] | `src/features/admin/components/certificates/CertificatesTab.tsx:537` | `@typescript-eslint/no-floating-promises` | error | Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator. |
| [x] | `src/features/admin/components/certificates/CertificatesTab.tsx:576` | `@typescript-eslint/no-floating-promises` | error | Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator. |
| [x] | `src/features/admin/components/compliance/BreachRegisterList.tsx:126` | `jsx-a11y/label-has-associated-control` | error | A form label must be associated with a control. |
| [x] | `src/features/admin/components/compliance/BreachRegisterList.tsx:127` | `jsx-a11y/label-has-associated-control` | error | A form label must be associated with a control. |
| [x] | `src/features/admin/components/dashboard/MalwareScannerStatus.tsx:20` | `react-hooks/set-state-in-effect` | error | Error: Calling setState synchronously within an effect can trigger cascading renders  Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following: * Update external systems with the latest state from React. * Subscribe for updates from some external system, calling setState in a callback function when external state changes.  Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).  C:\Users\rites\Desktop\school-certificate-portal-release\src\features\admin\components\dashboard\MalwareScannerStatus.tsx:20:10   18 \|   }, []);   19 \|   useEffect(() => { > 20 \|     void refresh();      \|          ^^^^^^^ Avoid calling setState() directly within an effect   21 \|     const timer = setInterval(() => void refresh(), 5 * 60_000);   22 \|     return () => { clearInterval(timer); };   23 \|   }, [refresh]); |
| [x] | `$1` | `@typescript-eslint/no-unused-expressions` | error | Expected an assignment or function call and instead saw an expression. |
| [x] | `$1` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `$1` | `@typescript-eslint/no-misused-promises` | error | Promise-returning function provided to attribute where a void return was expected. |
| [x] | `$1` | `@next/next/no-img-element` | warning | Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element |
| [x] | `src/features/admin/components/site/BrandingTab.tsx:378` | `react-hooks/purity` | error | Error: Cannot call impure function during render  `Date.now` is an impure function. Calling an impure function can produce unstable results that update unpredictably when the component happens to re-render. (https://react.dev/reference/rules/components-and-hooks-must-be-pure#components-and-hooks-must-be-idempotent).  C:\Users\rites\Desktop\school-certificate-portal-release\src\features\admin\components\site\BrandingTab.tsx:378:70   376 \|         <ul className="mt-4 space-y-2 text-sm">   377 \|           {adminLocationExceptions > 378 \|             .filter((item) => Date.parse(readText(item.expiresAt)) > Date.now())       \|                                                                      ^^^^^^^^^^ Cannot call impure function   379 \|             .map((item) => (   380 \|               <li key={readText(item.id)} className="rounded border p-3">   381 \|                 {item.country |
| [x] | `src/features/admin/hooks/useAdminData.ts:96` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:100` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:115` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:116` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:117` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:130` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:131` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:132` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:138` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:148` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:153` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:159` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:165` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:170` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:176` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:185` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary optional chain on a non-nullish value. |
| [x] | `src/features/admin/hooks/useAdminData.ts:189` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:196` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:201` | `@typescript-eslint/no-base-to-string` | error | 'x.adminLocationEnforcementMode ?? "block"' will use Object's default stringification format ('[object Object]') when stringified. |
| [x] | `src/features/admin/hooks/useAdminData.ts:202` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:209` | `@typescript-eslint/no-base-to-string` | error | 'x.retentionYears ?? 7' will use Object's default stringification format ('[object Object]') when stringified. |
| [x] | `src/features/admin/hooks/useAdminData.ts:210` | `@typescript-eslint/no-base-to-string` | error | 'x.backupRotationDays ?? 30' will use Object's default stringification format ('[object Object]') when stringified. |
| [x] | `src/features/admin/hooks/useAdminData.ts:217` | `@typescript-eslint/no-base-to-string` | error | '(x[k.startsWith("tagline_") ? "tagline_i18n" : "principalMessage_i18n"] as Record<string, unknown> \| undefined)?.[k.slice(k.lastIndexOf("_") + 1)] ?? ""' will use Object's default stringification format ('[object Object]') when stringified. |
| [x] | `src/features/admin/hooks/useAdminData.ts:224` | `@typescript-eslint/no-base-to-string` | error | 'x[k] ?? ""' will use Object's default stringification format ('[object Object]') when stringified. |
| [x] | `src/features/admin/hooks/useAdminData.ts:234` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |
| [x] | `src/features/admin/hooks/useAdminData.ts:246` | `@typescript-eslint/no-base-to-string` | error | 'a.textEn ?? ""' will use Object's default stringification format ('[object Object]') when stringified. |
| [x] | `src/features/admin/hooks/useAdminData.ts:248` | `@typescript-eslint/no-base-to-string` | error | 'a.linkUrl ?? ""' will use Object's default stringification format ('[object Object]') when stringified. |
| [x] | `src/features/admin/hooks/useAdminData.ts:253` | `react-hooks/exhaustive-deps` | error | React Hook useCallback has missing dependencies: 'setAdminIpAllowlist', 'setAdminLocationEnforcementMode', 'setAdminLocationExceptions', 'setAdmins', 'setAllowedAdminCountries', 'setAnnouncement', 'setBackupRotationDays', 'setBranding', 'setBreaches', 'setCatalog', 'setCerts', 'setClassOptions', 'setFaqs', 'setLogs', 'setMaintenanceMode', 'setPending', 'setRecentLocationBlocks', 'setReports', 'setRetentionYears', 'setRights', 'setSessionOptions', 'setStats', 'setTimeline', and 'setTypeOptions'. Either include them or remove the dependency array. If 'setStats' changes too often, find the parent component that defines it and wrap that definition in useCallback. |
| [x] | `$1` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, value is always falsy. |
| [x] | `$1` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, value is always truthy. |
| [x] | `src/features/auth/CodeSteps.tsx:16` | `react-hooks/set-state-in-effect` | error | Error: Calling setState synchronously within an effect can trigger cascading renders  Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following: * Update external systems with the latest state from React. * Subscribe for updates from some external system, calling setState in a callback function when external state changes.  Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).  C:\Users\rites\Desktop\school-certificate-portal-release\src\features\auth\CodeSteps.tsx:16:5   14 \|   const [remaining, setRemaining] = useState(resendAfterSeconds);   15 \|   useEffect(() => { > 16 \|     setRemaining(resendAfterSeconds);      \|     ^^^^^^^^^^^^ Avoid calling setState() directly within an effect   17 \|     const timer = window.setInterval(() => { setRemaining((value) => Math.max(0, value - 1)); }, 1000);   18 \|     return () => { window.clearInterval(timer); };   19 \|   }, [resendAfterSeconds]); |
| [x] | `src/features/auth/admin-session.tsx:73` | `react-hooks/set-state-in-effect` | error | Error: Calling setState synchronously within an effect can trigger cascading renders  Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following: * Update external systems with the latest state from React. * Subscribe for updates from some external system, calling setState in a callback function when external state changes.  Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).  C:\Users\rites\Desktop\school-certificate-portal-release\src\features\auth\admin-session.tsx:73:5   71 \|   useEffect(() => {   72 \|     let live = true; > 73 \|     setState({ status: "loading" });      \|     ^^^^^^^^ Avoid calling setState() directly within an effect   74 \|     void fetchSession().then((next) => {   75 \|       if (live) setState(next);   76 \|     }); |
| [x] | `src/features/certificates/FinderView.tsx:98` | `promise/catch-or-return` | error | Expected catch() or return |
| [x] | `src/features/certificates/FinderView.tsx:122` | `promise/catch-or-return` | error | Expected catch() or return |
| [ ] | `src/features/certificates/FinderView.tsx:580` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, value is always falsy. |
| [ ] | `src/features/certificates/FinderView.tsx:585` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, value is always falsy. |
| [x] | `src/features/faq/FaqView.tsx:76` | `react-hooks/set-state-in-effect` | error | Error: Calling setState synchronously within an effect can trigger cascading renders  Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following: * Update external systems with the latest state from React. * Subscribe for updates from some external system, calling setState in a callback function when external state changes.  Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).  C:\Users\rites\Desktop\school-certificate-portal-release\src\features\faq\FaqView.tsx:76:5   74 \|   useEffect(() => {   75 \|     let active = true; > 76 \|     setLoading(true);      \|     ^^^^^^^^^^ Avoid calling setState() directly within an effect   77 \|     fetch("/api/public/site-settings", { cache: "no-store" })   78 \|       .then(async (response) => {   79 \|         if (!response.ok) throw new Error("Unable to load FAQ"); |
| [x] | `$1` | `promise/catch-or-return` | error | Expected catch() or return |
| [x] | `$1` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary optional chain on a non-nullish value. |
| [x] | `$1` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary optional chain on a non-nullish value. |
| [x] | `src/features/feedback/FeedbackWidget.tsx:21` | `react-hooks/set-state-in-effect` | error | Error: Calling setState synchronously within an effect can trigger cascading renders  Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following: * Update external systems with the latest state from React. * Subscribe for updates from some external system, calling setState in a callback function when external state changes.  Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).  C:\Users\rites\Desktop\school-certificate-portal-release\src\features\feedback\FeedbackWidget.tsx:21:7   19 \|     if (choice === null) return;   20 \|     if (!siteKey) { > 21 \|       setError("Security verification is not configured. Feedback is temporarily unavailable.");      \|       ^^^^^^^^ Avoid calling setState() directly within an effect   22 \|       return;   23 \|     }   24 \|     if (!captcha.current) return; |
| [x] | `$1` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, value is always truthy. |
| [x] | `$1` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, value is always truthy. |
| [x] | `src/features/report/ReportWrongRecordModal.tsx:39` | `promise/catch-or-return` | error | Expected catch() or return |
| [x] | `src/features/report/ReportWrongRecordModal.tsx:260` | `@typescript-eslint/no-misused-promises` | error | Promise-returning function provided to attribute where a void return was expected. |
| [x] | `src/features/verify/VerifyView.tsx:72` | `promise/catch-or-return` | error | Expected catch() or return |
| [x] | `src/features/verify/VerifyView.tsx:232` | `@typescript-eslint/no-misused-promises` | error | Promise-returning function provided to attribute where a void return was expected. |
| [x] | `$1` | `@typescript-eslint/no-unnecessary-condition` | error | Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined. |

## Hard (256)

| Done | File:line | Rule | Severity | Diagnostic |
|---|---|---|---|---|
| [ ] | `e2e/responsive-teardown.ts:53` | `complexity` | error | Function 'isAuditRow' has a complexity of 18. Maximum allowed is 12. |
| [ ] | `e2e/responsive.spec.ts:22` | `max-lines-per-function` | error | Async function 'measure' has too many lines (121). Maximum allowed is 120. |
| [ ] | `e2e/responsive.spec.ts:23` | `complexity` | error | Arrow function has a complexity of 48. Maximum allowed is 12. |
| [ ] | `e2e/responsive.spec.ts:102` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'CSSGroupingRule' is more narrow than the original type. |
| [ ] | `src/app/api/admin/backup/route.ts:23` | `complexity` | error | Async function 'performBackup' has a complexity of 16. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/breaches/export/route.ts:85` | `complexity` | error | Async function 'createExport' has a complexity of 13. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:27` | `complexity` | error | Function 'parseCsv' has a complexity of 16. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:54` | `max-lines-per-function` | error | Async function 'POST' has too many lines (166). Maximum allowed is 120. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:54` | `complexity` | error | Async function 'POST' has a complexity of 66. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:78` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .name on an `any` value. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:80` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .size on an `any` value. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:106` | `complexity` | error | Arrow function has a complexity of 13. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:129` | `max-depth` | error | Blocks are nested too deeply (4). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:130` | `max-depth` | error | Blocks are nested too deeply (4). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:132` | `max-depth` | error | Blocks are nested too deeply (4). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:135` | `max-depth` | error | Blocks are nested too deeply (5). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:138` | `max-depth` | error | Blocks are nested too deeply (5). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:140` | `max-depth` | error | Blocks are nested too deeply (4). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:142` | `max-depth` | error | Blocks are nested too deeply (4). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:151` | `max-depth` | error | Blocks are nested too deeply (5). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:157` | `max-depth` | error | Blocks are nested too deeply (5). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:162` | `@typescript-eslint/no-unsafe-argument` | error | Unsafe argument of type `any` assigned to a parameter of type `string`. |
| [ ] | `src/app/api/admin/bulk-upload/preview/route.ts:176` | `max-depth` | error | Blocks are nested too deeply (4). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/bulk-upload/route.ts:46` | `max-lines-per-function` | error | Async function 'POST' has too many lines (182). Maximum allowed is 120. |
| [ ] | `src/app/api/admin/bulk-upload/route.ts:46` | `complexity` | error | Async function 'POST' has a complexity of 48. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/catalog/[kind]/route.ts:36` | `complexity` | error | Async function 'POST' has a complexity of 13. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/decision/route.ts:20` | `max-lines-per-function` | error | Async function 'POST' has too many lines (180). Maximum allowed is 120. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/decision/route.ts:20` | `complexity` | error | Async function 'POST' has a complexity of 38. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/decision/route.ts:57` | `complexity` | error | Async arrow function has a complexity of 21. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/history/route.ts:24` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/history/route.ts:25` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/history/route.ts:26` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/history/route.ts:26` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/history/route.ts:26` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/history/route.ts:26` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toDate on an `any` value. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/history/route.ts:26` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toISOString on an `any` value. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/route.ts:99` | `max-lines-per-function` | error | Async function 'PUT' has too many lines (176). Maximum allowed is 120. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/route.ts:99` | `complexity` | error | Async function 'PUT' has a complexity of 31. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/route.ts:160` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/route.ts:161` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/certificates/[certificateId]/route.ts:201` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/certificates/route.ts:97` | `max-params` | error | Async function 'storeCertificateRecord' has too many parameters (6). Maximum allowed is 4. |
| [ ] | `src/app/api/admin/certificates/route.ts:256` | `complexity` | error | Async function 'POST' has a complexity of 15. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/credentials/change-temporary-password/route.ts:12` | `complexity` | error | Async function 'POST' has a complexity of 27. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/credentials/change-temporary-password/route.ts:45` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/credentials/change-temporary-password/route.ts:53` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/credentials/change-temporary-password/route.ts:53` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toLowerCase on an `any` value. |
| [ ] | `src/app/api/admin/faqs/route.ts:44` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe assertion from `any` detected: consider using type guards or a safer assertion. |
| [ ] | `src/app/api/admin/faqs/route.ts:66` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .faqs on an `any` value. |
| [ ] | `src/app/api/admin/login-check/route.ts:29` | `complexity` | error | Async function 'POST' has a complexity of 27. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/login-check/route.ts:39` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe assertion from `any` detected: consider using type guards or a safer assertion. |
| [ ] | `src/app/api/admin/otp/send/route.ts:83` | `max-lines-per-function` | error | Async function 'POST' has too many lines (172). Maximum allowed is 120. |
| [ ] | `src/app/api/admin/otp/send/route.ts:83` | `complexity` | error | Async function 'POST' has a complexity of 32. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/otp/send/route.ts:101` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/otp/verify/route.ts:36` | `complexity` | error | Async function 'POST' has a complexity of 24. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/otp/verify/route.ts:52` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/preflight/route.ts:11` | `complexity` | error | Async function 'POST' has a complexity of 19. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/preflight/route.ts:32` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/preflight/route.ts:32` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toLowerCase on an `any` value. |
| [ ] | `src/app/api/admin/profile/route.ts:37` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type '("name" \| "address" \| "position" \| "preferredName" \| "staffId" \| "gender" \| "dateOfBirth" \| "department" \| "designation" \| "campus" \| "joiningDate" \| "reportingManager" \| "officeLocation" \| ... 9 more ... \| "photoDataUrl")[]' is more narrow than the original type. |
| [ ] | `src/app/api/admin/profile/route.ts:84` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'Record<string, unknown>' is more narrow than the original type. |
| [ ] | `src/app/api/admin/profile/route.ts:127` | `complexity` | error | Async function 'PATCH' has a complexity of 31. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/profile/route.ts:134` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'Record<string, unknown>' is more narrow than the original type. |
| [ ] | `src/app/api/admin/rights/route.ts:25` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type '{ code?: string \| number; message?: string; }' is more narrow than the original type. |
| [ ] | `src/app/api/admin/rights/route.ts:44` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type '{ toMillis?: () => number; }' is more narrow than the original type. |
| [ ] | `src/app/api/admin/rights/route.ts:77` | `complexity` | error | Async function 'PATCH' has a complexity of 21. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/rights/route.ts:79` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe assertion from `any` detected: consider using type guards or a safer assertion. |
| [ ] | `src/app/api/admin/session/revoke-all/route.ts:30` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/session/revoke-all/route.ts:30` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/session/revoke-all/route.ts:30` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/session/revoke-all/route.ts:30` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toDate on an `any` value. |
| [ ] | `src/app/api/admin/session/revoke-all/route.ts:30` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .getTime on an `any` value. |
| [ ] | `src/app/api/admin/session/revoke-all/route.ts:31` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/session/revoke-all/route.ts:54` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/session/revoke-all/route.ts:54` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/session/revoke-all/route.ts:54` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/session/revoke-all/route.ts:54` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toDate on an `any` value. |
| [ ] | `src/app/api/admin/session/revoke-all/route.ts:54` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .getTime on an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:54` | `max-lines-per-function` | error | Async function 'POST' has too many lines (226). Maximum allowed is 120. |
| [ ] | `src/app/api/admin/session/route.ts:54` | `complexity` | error | Async function 'POST' has a complexity of 47. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/session/route.ts:93` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:101` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/session/route.ts:101` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toLowerCase on an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:189` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:199` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:258` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:284` | `complexity` | error | Async function 'GET' has a complexity of 32. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/session/route.ts:307` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:310` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:310` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/session/route.ts:310` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/session/route.ts:310` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toDate on an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:310` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .getTime on an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:311` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:311` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/session/route.ts:311` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/session/route.ts:311` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toDate on an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:311` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .getTime on an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:316` | `@typescript-eslint/no-unsafe-argument` | error | Unsafe argument of type `any` assigned to a parameter of type `number`. |
| [ ] | `src/app/api/admin/session/route.ts:316` | `@typescript-eslint/no-unsafe-argument` | error | Unsafe argument of type `any` assigned to a parameter of type `number`. |
| [ ] | `src/app/api/admin/session/route.ts:327` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/session/route.ts:327` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toLowerCase on an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:336` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/session/route.ts:338` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/students/import/route.ts:73` | `complexity` | error | Function 'csvRows' has a complexity of 16. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/students/import/route.ts:140` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/students/import/route.ts:141` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/students/import/route.ts:151` | `max-lines-per-function` | error | Async function 'POST' has too many lines (338). Maximum allowed is 120. |
| [ ] | `src/app/api/admin/students/import/route.ts:151` | `complexity` | error | Async function 'POST' has a complexity of 56. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/students/import/route.ts:227` | `complexity` | error | Async arrow function has a complexity of 29. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/students/import/route.ts:343` | `max-depth` | error | Blocks are nested too deeply (4). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/students/import/route.ts:344` | `max-depth` | error | Blocks are nested too deeply (5). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/students/import/route.ts:366` | `max-depth` | error | Blocks are nested too deeply (4). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/students/import/route.ts:458` | `max-depth` | error | Blocks are nested too deeply (4). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/students/list/route.ts:32` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/students/list/route.ts:33` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/students/list/route.ts:34` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/students/list/route.ts:62` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/students/list/route.ts:63` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/students/list/route.ts:64` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/students/list/route.ts:65` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/students/route.ts:51` | `max-lines-per-function` | error | Async function 'POST' has too many lines (370). Maximum allowed is 120. |
| [ ] | `src/app/api/admin/students/route.ts:51` | `complexity` | error | Async function 'POST' has a complexity of 68. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/students/route.ts:350` | `max-depth` | error | Blocks are nested too deeply (4). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/students/route.ts:351` | `max-depth` | error | Blocks are nested too deeply (5). Maximum allowed is 3. |
| [ ] | `src/app/api/admin/templates/route.ts:21` | `max-lines-per-function` | error | Async function 'GET' has too many lines (166). Maximum allowed is 120. |
| [ ] | `src/app/api/admin/templates/route.ts:21` | `complexity` | error | Async function 'GET' has a complexity of 16. Maximum allowed is 12. |
| [ ] | `src/app/api/admin/templates/route.ts:87` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'Worksheet & { dataValidations: { add: (range: string, validation: DataValidation) => void; }; }' is more narrow than the original type. |
| [ ] | `src/app/api/admin/timeline/route.ts:52` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/timeline/route.ts:52` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toMillis on an `any` value. |
| [ ] | `src/app/api/admin/timeline/route.ts:53` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/timeline/route.ts:53` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toMillis on an `any` value. |
| [ ] | `src/app/api/admin/timeline/route.ts:81` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/timeline/route.ts:82` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/timeline/route.ts:86` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/admin/timeline/route.ts:86` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/timeline/route.ts:86` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/admin/timeline/route.ts:86` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toDate on an `any` value. |
| [ ] | `src/app/api/admin/timeline/route.ts:86` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toISOString on an `any` value. |
| [ ] | `src/app/api/certificates/[certId]/file/route.ts:37` | `complexity` | error | Async function 'GET' has a complexity of 27. Maximum allowed is 12. |
| [ ] | `src/app/api/certificates/bundle/route.ts:33` | `complexity` | error | Async function 'GET' has a complexity of 37. Maximum allowed is 12. |
| [ ] | `src/app/api/certificates/bundle/route.ts:106` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'ReadableStream<Uint8Array<ArrayBufferLike>>' is more narrow than the original type. |
| [ ] | `src/app/api/certificates/print/route.ts:26` | `complexity` | error | Async function 'GET' has a complexity of 34. Maximum allowed is 12. |
| [ ] | `src/app/api/certificates/search/route.ts:139` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/certificates/search/route.ts:140` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/certificates/search/route.ts:141` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/certificates/search/route.ts:142` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toMillis on an `any` value. |
| [ ] | `src/app/api/certificates/search/route.ts:142` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/certificates/search/route.ts:142` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toMillis on an `any` value. |
| [ ] | `src/app/api/certificates/search/route.ts:143` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/certificates/search/route.ts:144` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toMillis on an `any` value. |
| [ ] | `src/app/api/certificates/search/route.ts:144` | `@typescript-eslint/no-unsafe-call` | error | Unsafe call of an `any` typed value. |
| [ ] | `src/app/api/certificates/search/route.ts:144` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .toMillis on an `any` value. |
| [ ] | `src/app/api/certificates/search/route.ts:193` | `max-lines-per-function` | error | Async function 'POST' has too many lines (168). Maximum allowed is 120. |
| [ ] | `src/app/api/certificates/search/route.ts:193` | `complexity` | error | Async function 'POST' has a complexity of 28. Maximum allowed is 12. |
| [ ] | `src/app/api/certificates/search/route.ts:204` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'Record<string, unknown>' is more narrow than the original type. |
| [ ] | `src/app/api/certificates/verify/route.ts:107` | `complexity` | error | Async function 'POST' has a complexity of 37. Maximum allowed is 12. |
| [ ] | `src/app/api/public/classes/route.ts:16` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/public/classes/route.ts:17` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/app/api/public/sessions/route.ts:24` | `max-depth` | error | Blocks are nested too deeply (4). Maximum allowed is 3. |
| [ ] | `src/app/api/public/sessions/route.ts:26` | `max-depth` | error | Blocks are nested too deeply (5). Maximum allowed is 3. |
| [ ] | `src/app/api/public/sessions/route.ts:33` | `max-depth` | error | Blocks are nested too deeply (4). Maximum allowed is 3. |
| [ ] | `src/app/api/public/sessions/route.ts:35` | `max-depth` | error | Blocks are nested too deeply (4). Maximum allowed is 3. |
| [ ] | `src/features/admin/components/admins/AdminsTab.tsx:140` | `max-lines-per-function` | error | Function 'AdminRow' has too many lines (122). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/approvals/ApprovalsTab.tsx:47` | `complexity` | error | Arrow function has a complexity of 13. Maximum allowed is 12. |
| [ ] | `src/features/admin/components/catalog/CatalogTab.tsx:77` | `max-lines-per-function` | error | Function 'CatalogTab' has too many lines (209). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/certificates/CertificatesTab.tsx:59` | `max-lines-per-function` | error | Function 'CertificatesTab' has too many lines (554). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/certificates/CertificatesTab.tsx:385` | `max-lines-per-function` | error | Arrow function has too many lines (207). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/certificates/CertificatesTab.tsx:385` | `complexity` | error | Arrow function has a complexity of 14. Maximum allowed is 12. |
| [ ] | `src/features/admin/components/certificates/CertificatesTab.tsx:496` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/features/admin/components/certificates/CertificatesTab.tsx:497` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .duplicateFileWarning on an `any` value. |
| [ ] | `src/features/admin/components/certificates/CertificatesTab.tsx:499` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .error on an `any` value. |
| [ ] | `src/features/admin/components/certificates/CertificatesTab.tsx:501` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .error on an `any` value. |
| [ ] | `src/features/admin/components/certificates/CertificatesTab.tsx:606` | `max-lines` | error | File has too many lines (607). Maximum allowed is 600. |
| [ ] | `src/features/admin/components/compliance/BreachDrafts.tsx:27` | `max-lines-per-function` | error | Function 'BreachDrafts' has too many lines (138). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/compliance/ContactEnquiriesTab.tsx:55` | `max-lines-per-function` | error | Function 'ContactEnquiriesTab' has too many lines (331). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/compliance/ContactEnquiriesTab.tsx:190` | `max-lines-per-function` | error | Arrow function has too many lines (188). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/compliance/ReportsTab.tsx:146` | `max-lines-per-function` | error | Function 'ReportCard' has too many lines (126). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/compliance/RightsTab.tsx:33` | `max-lines-per-function` | error | Function 'RightsTab' has too many lines (248). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/compliance/RightsTab.tsx:119` | `max-lines-per-function` | error | Arrow function has too many lines (157). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/compliance/breach-types.ts:63` | `complexity` | error | Function 'parseIncident' has a complexity of 34. Maximum allowed is 12. |
| [ ] | `src/features/admin/components/dashboard/DashboardOverview.tsx:24` | `max-lines-per-function` | error | Function 'DashboardOverview' has too many lines (160). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/dashboard/MalwareScannerStatus.tsx:7` | `complexity` | error | Function 'MalwareScannerStatus' has a complexity of 15. Maximum allowed is 12. |
| [ ] | `src/features/admin/components/dashboard/MalwareScannerStatus.tsx:14` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe assertion from `any` detected: consider using type guards or a safer assertion. |
| [ ] | `src/features/admin/components/dashboard/MalwareScannerStatus.tsx:29` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe assertion from `any` detected: consider using type guards or a safer assertion. |
| [ ] | `src/features/admin/components/layout/AdminHeader.tsx:37` | `max-lines-per-function` | error | Function 'AdminHeader' has too many lines (141). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/profile/ProfileTab.tsx:164` | `max-lines-per-function` | error | Function 'ProfileTab' has too many lines (638). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/profile/ProfileTab.tsx:164` | `complexity` | error | Function 'ProfileTab' has a complexity of 23. Maximum allowed is 12. |
| [ ] | `src/features/admin/components/profile/ProfileTab.tsx:624` | `max-lines` | error | File has too many lines (824). Maximum allowed is 600. |
| [ ] | `src/features/admin/components/site/BrandingTab.tsx:37` | `max-lines-per-function` | error | Function 'BrandingTab' has too many lines (371). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/students/StudentCreatePanel.tsx:46` | `max-lines-per-function` | error | Function 'StudentCreatePanel' has too many lines (338). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/students/StudentImportPanel.tsx:86` | `max-lines-per-function` | error | Function 'StudentImportPanel' has too many lines (185). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/students/StudentsList.tsx:94` | `max-lines-per-function` | error | Function 'StudentsList' has too many lines (694). Maximum allowed is 120. |
| [ ] | `src/features/admin/components/students/StudentsList.tsx:94` | `complexity` | error | Function 'StudentsList' has a complexity of 20. Maximum allowed is 12. |
| [ ] | `src/features/admin/components/students/StudentsList.tsx:628` | `max-lines` | error | File has too many lines (772). Maximum allowed is 600. |
| [ ] | `src/features/admin/hooks/useAdminApi.ts:66` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'T' is more narrow than the original type. |
| [ ] | `src/features/admin/hooks/useAdminData.ts:54` | `max-lines-per-function` | error | Function 'useAdminData' has too many lines (216). Maximum allowed is 120. |
| [ ] | `src/features/admin/hooks/useAdminData.ts:93` | `max-lines-per-function` | error | Async arrow function has too many lines (161). Maximum allowed is 120. |
| [ ] | `src/features/admin/hooks/useAdminData.ts:93` | `complexity` | error | Async arrow function has a complexity of 60. Maximum allowed is 12. |
| [x] | `src/features/admin/hooks/useAdminData.ts:205` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe assertion from `any` detected: consider using type guards or a safer assertion. |
| [x] | `src/features/admin/hooks/useAdminData.ts:217` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'Record<string, unknown> \| undefined' is more narrow than the original type. |
| [x] | `src/features/admin/hooks/useAdminData.ts:220` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe assertion from `any` detected: consider using type guards or a safer assertion. |
| [x] | `src/features/admin/hooks/useAdminData.ts:247` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'Record<string, string>' is more narrow than the original type. |
| [ ] | `src/features/admin/hooks/useAdminUsers.ts:20` | `max-lines-per-function` | error | Function 'useAdminUsers' has too many lines (135). Maximum allowed is 120. |
| [ ] | `src/features/admin/hooks/useSiteSettingsAdmin.ts:15` | `max-lines-per-function` | error | Function 'useSiteSettingsAdmin' has too many lines (128). Maximum allowed is 120. |
| [ ] | `src/features/admin/hooks/useSiteSettingsAdmin.ts:54` | `@typescript-eslint/no-unsafe-return` | error | Unsafe return of a value of type `any`. |
| [ ] | `src/features/admin/hooks/useSiteSettingsAdmin.ts:62` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/features/admin/hooks/useSiteSettingsAdmin.ts:63` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |
| [ ] | `src/features/auth/admin-session.tsx:48` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe assertion from `any` detected: consider using type guards or a safer assertion. |
| [ ] | `src/features/certificates/FinderView.tsx:39` | `max-lines-per-function` | error | Function 'FinderPage' has too many lines (885). Maximum allowed is 120. |
| [ ] | `src/features/certificates/FinderView.tsx:39` | `complexity` | error | Function 'FinderPage' has a complexity of 49. Maximum allowed is 12. |
| [x] | `src/features/certificates/FinderView.tsx:84` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'keyof FormValues' is more narrow than the original type. |
| [x] | `src/features/certificates/FinderView.tsx:90` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'keyof FormValues' is more narrow than the original type. |
| [x] | `src/features/certificates/FinderView.tsx:101` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe assertion from `any` detected: consider using type guards or a safer assertion. |
| [x] | `src/features/certificates/FinderView.tsx:125` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe assertion from `any` detected: consider using type guards or a safer assertion. |
| [x] | `src/features/certificates/FinderView.tsx:148` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'HTMLScriptElement \| null' is more narrow than the original type. |
| [ ] | `src/features/certificates/FinderView.tsx:217` | `complexity` | error | Async function 'submit' has a complexity of 28. Maximum allowed is 12. |
| [x] | `src/features/certificates/FinderView.tsx:280` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'StudentResult' is more narrow than the original type. |
| [x] | `src/features/certificates/FinderView.tsx:281` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'StudentResult' is more narrow than the original type. |
| [ ] | `src/features/certificates/FinderView.tsx:613` | `max-lines` | error | File has too many lines (919). Maximum allowed is 600. |
| [ ] | `src/features/faq/FaqView.tsx:65` | `max-lines-per-function` | error | Function 'FaqPage' has too many lines (246). Maximum allowed is 120. |
| [x] | `src/features/faq/FaqView.tsx:80` | `@typescript-eslint/no-unsafe-return` | error | Unsafe return of a value of type `Promise<any>`. |
| [x] | `src/features/faq/FaqView.tsx:85` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .settings on an `any` value. |
| [x] | `src/features/faq/FaqView.tsx:86` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe assertion from `any` detected: consider using type guards or a safer assertion. |
| [x] | `src/features/faq/FaqView.tsx:86` | `@typescript-eslint/no-unsafe-member-access` | error | Unsafe member access .settings on an `any` value. |
| [ ] | `src/features/feedback/FeedbackWidget.tsx:7` | `max-lines-per-function` | error | Function 'FeedbackWidget' has too many lines (175). Maximum allowed is 120. |
| [x] | `src/features/feedback/FeedbackWidget.tsx:47` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'HTMLScriptElement \| null' is more narrow than the original type. |
| [x] | `src/features/feedback/FeedbackWidget.tsx:85` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe assertion from `any` detected: consider using type guards or a safer assertion. |
| [ ] | `src/features/home/HomeView.tsx:69` | `max-lines-per-function` | error | Function 'HomePage' has too many lines (211). Maximum allowed is 120. |
| [ ] | `src/features/info/ContactView.tsx:27` | `max-lines-per-function` | error | Function 'ContactView' has too many lines (215). Maximum allowed is 120. |
| [ ] | `src/features/legal/PrivacyView.tsx:23` | `max-lines-per-function` | error | Function 'PrivacyPage' has too many lines (596). Maximum allowed is 120. |
| [ ] | `src/features/legal/PrivacyView.tsx:610` | `max-lines` | error | File has too many lines (612). Maximum allowed is 600. |
| [ ] | `src/features/legal/TermsView.tsx:10` | `max-lines-per-function` | error | Function 'TermsPage' has too many lines (214). Maximum allowed is 120. |
| [ ] | `src/features/report/ReportWrongRecordModal.tsx:15` | `max-lines-per-function` | error | Function 'ReportWrongRecordModal' has too many lines (496). Maximum allowed is 120. |
| [ ] | `src/features/report/ReportWrongRecordModal.tsx:15` | `complexity` | error | Function 'ReportWrongRecordModal' has a complexity of 27. Maximum allowed is 12. |
| [ ] | `src/features/report/ReportWrongRecordModal.tsx:124` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'HTMLScriptElement \| null' is more narrow than the original type. |
| [ ] | `src/features/report/ReportWrongRecordModal.tsx:145` | `complexity` | error | Async function 'submit' has a complexity of 14. Maximum allowed is 12. |
| [ ] | `src/features/report/ReportWrongRecordModal.tsx:186` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe assertion from `any` detected: consider using type guards or a safer assertion. |
| [ ] | `src/features/site-map/SiteMapView.tsx:85` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'CSSProperties' is more narrow than the original type. |
| [ ] | `src/features/verify/VerifyView.tsx:45` | `max-lines-per-function` | error | Function 'VerifyPage' has too many lines (375). Maximum allowed is 120. |
| [ ] | `src/features/verify/VerifyView.tsx:45` | `complexity` | error | Function 'VerifyPage' has a complexity of 36. Maximum allowed is 12. |
| [ ] | `src/features/verify/VerifyView.tsx:109` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'HTMLScriptElement \| null' is more narrow than the original type. |
| [ ] | `src/features/verify/VerifyView.tsx:167` | `complexity` | error | Async function 'submit' has a complexity of 16. Maximum allowed is 12. |
| [ ] | `src/features/verify/VerifyView.tsx:199` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'Verification' is more narrow than the original type. |
| [ ] | `src/features/verify/VerifyView.tsx:201` | `@typescript-eslint/no-unsafe-type-assertion` | error | Unsafe type assertion: type 'Verification' is more narrow than the original type. |
| [ ] | `src/server/env.ts:73` | `max-lines-per-function` | error | Arrow function has too many lines (183). Maximum allowed is 120. |
| [ ] | `src/server/env.ts:73` | `complexity` | error | Arrow function has a complexity of 56. Maximum allowed is 12. |
| [ ] | `src/server/mailer.ts:159` | `complexity` | error | Async function 'sendAdminOtpEmail' has a complexity of 22. Maximum allowed is 12. |
| [ ] | `src/server/mailer.ts:232` | `complexity` | error | Async function 'sendAdminInvitationEmail' has a complexity of 22. Maximum allowed is 12. |
| [ ] | `src/server/malware-rescan.ts:14` | `complexity` | error | Async function 'rescanCertificateBatch' has a complexity of 33. Maximum allowed is 12. |
| [ ] | `src/server/malware-rescan.ts:68` | `max-depth` | error | Blocks are nested too deeply (4). Maximum allowed is 3. |
| [ ] | `src/server/security.ts:52` | `complexity` | error | Async function 'writeAuditLog' has a complexity of 17. Maximum allowed is 12. |
| [ ] | `src/server/security.ts:471` | `complexity` | error | Async function 'requireAdmin' has a complexity of 13. Maximum allowed is 12. |
| [ ] | `src/server/security.ts:615` | `max-lines` | error | File has too many lines (618). Maximum allowed is 600. |
| [ ] | `tests/malware-scan.test.ts:27` | `complexity` | error | Arrow function has a complexity of 14. Maximum allowed is 12. |
| [ ] | `tests/malware-scan.test.ts:102` | `@typescript-eslint/no-unsafe-assignment` | error | Unsafe assignment of an `any` value. |

Total tracked diagnostics: 375. Solved: 134; unchecked: 241.
