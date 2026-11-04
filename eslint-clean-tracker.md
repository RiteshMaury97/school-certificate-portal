# ESLint clean tracker

Repository-wide ESLint diagnostic inventory. Sorted by effort: resolved items first, straightforward type and parameter fixes next, then structural refactors. Every unchecked row is a current ESLint error.

Remaining ESLint errors: 195

| Done | Level | File and line | Rule | Error |
|---|---|---|---|---|
| [x] | Solved | `e2e/responsive.spec.ts:102` | `@typescript-eslint/no-unsafe-type-assertion` | Unsafe type assertion: type CSSGroupingRule is more narrow than the original type (fixed using instanceof narrowing; focused ESLint check confirmed this diagnostic cleared). |
| [ ] | Easy | `src/app/api/admin/bulk-upload/preview/route.ts:78` | `@typescript-eslint/no-unsafe-member-access` | Unsafe member access .name on an `any` value. |
| [ ] | Easy | `src/app/api/admin/bulk-upload/preview/route.ts:80` | `@typescript-eslint/no-unsafe-member-access` | Unsafe member access .size on an `any` value. |
| [ ] | Easy | `src/app/api/admin/bulk-upload/preview/route.ts:161` | `@typescript-eslint/no-unsafe-argument` | Unsafe argument of type `any` assigned to a parameter of type `string`. |
| [ ] | Easy | `src/app/api/admin/certificates/[certificateId]/route.ts:160` | `@typescript-eslint/no-unsafe-assignment` | Unsafe assignment of an `any` value. |
| [ ] | Easy | `src/app/api/admin/certificates/[certificateId]/route.ts:161` | `@typescript-eslint/no-unsafe-assignment` | Unsafe assignment of an `any` value. |
| [ ] | Easy | `src/app/api/admin/certificates/[certificateId]/route.ts:201` | `@typescript-eslint/no-unsafe-assignment` | Unsafe assignment of an `any` value. |
| [ ] | Easy | `src/app/api/admin/certificates/route.ts:97` | `max-params` | Async function 'storeCertificateRecord' has too many parameters (6). Maximum allowed is 4. |
| [ ] | Easy | `src/app/api/admin/otp/send/route.ts:101` | `@typescript-eslint/no-unsafe-assignment` | Unsafe assignment of an `any` value. |
| [ ] | Easy | `src/app/api/admin/profile/route.ts:37` | `@typescript-eslint/no-unsafe-type-assertion` | Unsafe type assertion: type '("name" \| "address" \| "position" \| "preferredName" \| "staffId" \| "gender" \| "dateOfBirth" \| "department" \| "designation" \| "campus" \| "joiningDate" \| "reportingManager" \| "officeLocation" \| ... 9 more ... \| "photoDataUrl")[]' is more narrow than the original type. |
| [ ] | Easy | `src/app/api/admin/profile/route.ts:84` | `@typescript-eslint/no-unsafe-type-assertion` | Unsafe type assertion: type 'Record<string, unknown>' is more narrow than the original type. |
| [ ] | Easy | `src/app/api/admin/profile/route.ts:134` | `@typescript-eslint/no-unsafe-type-assertion` | Unsafe type assertion: type 'Record<string, unknown>' is more narrow than the original type. |
| [ ] | Easy | `src/app/api/admin/rights/route.ts:25` | `@typescript-eslint/no-unsafe-type-assertion` | Unsafe type assertion: type '{ code?: string \| number; message?: string; }' is more narrow than the original type. |
| [ ] | Easy | `src/app/api/admin/rights/route.ts:44` | `@typescript-eslint/no-unsafe-type-assertion` | Unsafe type assertion: type '{ toMillis?: () => number; }' is more narrow than the original type. |

