/**
 * Safety replacement for the legacy destructive retention script.
 * Retention automation is now a weekly flag-only API job. No scheduled process
 * may erase records automatically; a superadmin must review and approve erasure.
 */
process.stdout.write("Retention execution is disabled. No data was changed.\n");
process.stdout.write(
  "Use the secured /api/cron/retention job to flag expired records for human review.\n",
);
if (process.argv.includes("--execute")) {
  process.stdout.write(
    "The --execute flag is intentionally ignored. Erasure requires explicit superadmin review.\n",
  );
}
