# Platform Website (Trimmed from AetherPanel)

This is a stripped-down build of the original AetherPanel game-server hosting
panel. It keeps the **public marketing website**, **billing system**, and
**admin panel**, and removes the **customer-facing game server management**
features (server console, file manager, deploy wizard, SFTP, backups, node
provisioning) along with all backend infrastructure that supported them
(node agent, console websocket, SFTP daemon, scheduler, Playit tunnel
integration, database-host provisioning).

## What's included

- **Public site**: Home, Minecraft Hosting, Bot Hosting, Pricing, Status,
  Docs, Legal pages
- **Auth**: Login, Register (email/password, Google, Discord OAuth)
- **Customer account**: Dashboard (account overview), Billing (credits,
  orders, coupons, manual + instant payment methods), Support Tickets,
  Activity Log, Account Settings (profile, password, Discord link, webhooks)
- **Admin panel**: System Overview, User Accounts, Products & Plans, Orders
  & Billing, Coupons, Announcements, Ad Campaigns, Discord Integration,
  Fonts & Themes, Support Queue, Audit Trail, REST API Keys, Legal &
  Policies, Platform Settings (general, auth providers, anti-abuse,
  payments, pending approvals)
- **Status page**: incident tracking and scheduled maintenance, backed by
  static core components (Website, API, Database, Payments, Discord,
  Support) rather than live server/node telemetry

## What was removed

- Customer server management panel (server list, console, file manager,
  deploy wizard, backups, databases, schedules, subusers)
- Node/allocation admin pages (Compute Nodes, Server Types, Monitoring,
  System Diagnostics, Backups & Storage)
- AFK Rewards (a server-uptime gamification feature with no purpose once
  there are no hosted servers to keep alive)
- Backend: node agent, console websocket server, SFTP server, task
  scheduler, Playit.gg tunnel integration, network protection service,
  database-host provisioning service, panel self-update pipeline
- Discord bot's per-server slash commands (`/server start|stop|restart`,
  etc.) — the bot now only handles account linking and account/billing
  notifications via a single default webhook

## Before you deploy

**This sandbox has no network access, so `npm install` and a real
TypeScript build (`tsc --noEmit` / `vite build`) were never run here.**
Everything was verified with static analysis (import/export resolution
across all 73 source files, structural diffing against the original
codebase for files that were trimmed via line-range extraction), which
caught and fixed two real bugs (missing `DEFAULT_HERO_DESCRIPTION` /
`DEFAULT_FOOTER_DESCRIPTION` constants in `AdminSettings.tsx`). Still,
please run the following before deploying:

```bash
npm install
npm run lint     # tsc --noEmit — catches anything static analysis couldn't
npm run dev      # smoke-test locally
npm run build    # production build
```

Fix any TypeScript errors that surface — static analysis can't catch
everything a real compiler will (e.g. subtle type mismatches).

## Configuration

Copy `.env.example` to `.env` and fill in:

- `JWT_SECRET` — required, used to sign auth tokens
- `AETHER_ADMIN_EMAIL` / `AETHER_ADMIN_PASSWORD` — bootstrap super-admin
  account, created automatically on first run
- Discord OAuth + bot credentials (optional, needed for Discord login and
  notifications)
- Firebase credentials (optional, needed for Google login)
- `VPN_CHECK_API_KEY` (optional, needed for the anti-abuse IP risk checks)

## Known gaps to review

- **Seed data**: the original `data/db.json` had richer sample data
  (specific coupon codes, sample support tickets, etc.) than what's seeded
  in the new `db.ts` defaults. The new defaults include the real product
  catalog (2 products, 10 pricing plans) and settings, but not sample
  orders/tickets. The app creates its own `data/db.json` on first run and
  will self-seed from the defaults in `server/db.ts`.
- **Payment methods**: UPI, bank transfer, and crypto payment instructions
  in `db.ts`'s default settings are placeholder values — update them from
  the Admin → Platform Settings → Payments tab before going live.
- **Branding**: default brand name/tagline/hero copy reference "AetherPanel"
  as a placeholder — update from Admin → Platform Settings → General, or
  edit the defaults directly in `server/db.ts`.
