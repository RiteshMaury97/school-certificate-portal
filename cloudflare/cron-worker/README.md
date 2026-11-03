# Optional Cloudflare breach reminder scheduler

This Worker calls the portal's protected breach reminder endpoint every 30 minutes. It is an
optional external scheduler example; Wrangler and an emulator are not installed by this project.

Set `SITE_URL` to the production site origin (for example, `https://portal.example.edu`) as a
Worker environment variable. Store the same random secret configured as `CRON_SECRET` on the site
as a Worker secret. Use a value of at least 32 characters.

```sh
npx wrangler secret put CRON_SECRET
npx wrangler deploy
```

Configure `SITE_URL` in the Cloudflare dashboard under the Worker settings, or add a `[vars]`
section to `wrangler.toml` with the origin. Do not commit the secret. The Worker sends it only in
the `Authorization: Bearer` header to `/api/cron/breach-reminders`.
