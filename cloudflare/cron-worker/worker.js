export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      fetch(`${env.SITE_URL.replace(/\/$/, "")}/api/cron/breach-reminders`, {
        method: "GET",
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      }).then(async (response) => {
        if (!response.ok) throw new Error(`Breach reminder request failed: ${response.status}`);
      }),
    );
  },
};
