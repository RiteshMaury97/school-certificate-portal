/**
 * Safety replacement for the legacy destructive retention script.
 * Retention automation is now a weekly flag-only API job. No scheduled process
 * may erase records automatically; a superadmin must review and approve erasure.
 */
console.log("Retention execution is disabled. No data was changed.");
console.log(
  "Use the secured /api/cron/retention job to flag expired records for human review.",
);
if (process.argv.includes("--execute")) {
  console.log(
    "The --execute flag is intentionally ignored. Erasure requires explicit superadmin review.",
  );
}
