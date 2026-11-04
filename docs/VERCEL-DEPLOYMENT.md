# Vercel deployment

Connect the GitHub repository to Vercel and use the project defaults in `vercel.json`: Next.js framework, `npm install`, `next build`, and Mumbai (`bom1`) for functions. Hobby supports one function region. Create the Firestore database in Mumbai (`asia-south1`) to keep application and database traffic nearby; Firestore's database location cannot be changed after creation.

All scheduled jobs run at `0 4 * * *` UTC (Vercel Hobby permits at most one execution per day). That is approximately 09:30 IST. Hobby may invoke a cron at any time within the scheduled hour. The backup, security summary, breach reminder, and malware rescan routes each have a daily schedule.

Function durations in `vercel.json` are set only for upload, document generation/export, backup, and cron routes that need additional time. They are capped at 60 seconds, within the current Hobby maximum. Security headers are defined only in `next.config.ts`.

Set production environment variables in Vercel, including all values shown in `.env.example`. ClamAV must be hosted by the school on a private network reachable from the Vercel application; Vercel's serverless network cannot directly join an arbitrary private Docker network, so arrange a restricted VPN/TLS tunnel or a private reachable container/VPS endpoint. Never expose unauthenticated clamd TCP port 3310 publicly.

The repository's `.vercelignore` omits development-only tests, docs and scripts while retaining `public/fonts`, application source and runtime assets. `next.config.ts` explicitly traces the TTF files needed by certificate PDF routes.
