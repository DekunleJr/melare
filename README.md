# MelareBeauty

Hairdressing and hair products website: online shop, salon and mobile appointment booking, one checkout for both, customer accounts and an admin dashboard.

Built with Next.js 16 (frontend and backend), MariaDB or MySQL through Drizzle ORM and `mysql2`, Better Auth, PayPal and Resend.

## Run it on this computer

1. Start **MySQL** in the XAMPP Control Panel.
2. In this folder:

```bash
npm install
npm run db:migrate    # create or update the tables
npm run db:seed       # optional sample content (only if the shop is empty)
npm run create-admin  # make an administrator account
npm run dev
```

3. Open <http://localhost:3000>. The dashboard is at <http://localhost:3000/admin>.

To run the production version instead: `npm run build`, then `npm start`. The database must be running for both, and you must build again after changing code.

**Updating an existing copy:** back up first (`npm run backup`), then `npm install`, `npm run db:migrate` and build again.

### Setting up on another computer

Create an empty database and a user for it, copy `.env.example` to `.env.local`, fill it in, then follow the steps above.

```sql
CREATE DATABASE melare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'melare_app'@'localhost' IDENTIFIED BY 'choose-a-password';
GRANT ALL PRIVILEGES ON melare.* TO 'melare_app'@'localhost';
```

## Connect PayPal

Without keys the site works, but nobody can pay online (pay-at-salon bookings still work).

1. At <https://developer.paypal.com/dashboard/applications> create a **Sandbox** app.
2. Put its client ID and secret into `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `.env.local`, keep `PAYPAL_ENV=sandbox`, and restart.
3. Buy something using a sandbox **personal** account from the PayPal developer dashboard, or a sandbox test card.

Payments are confirmed without a webhook, so local testing needs nothing more.

### Webhook (once the site has a public https address)

In the same PayPal app add a webhook pointing to `https://your-domain/api/paypal/webhook`, then put its ID in `PAYPAL_WEBHOOK_ID`. Select:

- Checkout order approved
- Payment capture completed, pending, denied, declined, refunded, reversed

It covers customers who close the page too early, payments PayPal holds for review, and refunds made inside PayPal.

### Cards, Apple Pay and Google Pay

- **PayPal and debit or credit cards** appear on the payment page. Whether guests can pay by card without a PayPal account depends on your PayPal account settings.
- **Google Pay** appears only after you enable it for the app in the PayPal dashboard and your account is approved for it.
- **Apple Pay** needs approval from PayPal, an https site and domain registration. Put the domain association file PayPal gives you at `public/.well-known/apple-developer-merchantid-domain-association`. It only shows on Apple devices.

### Going live

Create a **Live** app, use its keys and webhook ID, set `PAYPAL_ENV=live`, and make a small real purchase and refund it.

## Email (Resend)

1. Create an API key at <https://resend.com/api-keys> and put it in `RESEND_API_KEY`.
2. While testing, keep `EMAIL_FROM="MelareBeauty <onboarding@resend.dev>"`. Resend only delivers this test sender to **your own account's address**.
3. To email customers, verify your domain at <https://resend.com/domains> and change `EMAIL_FROM` to an address on it.
4. Set the **contact person's email** in Admin > Settings. They receive new bookings, requests, orders and messages.

While `RESEND_API_KEY` is empty, development prints emails in the terminal. Every email is listed under Admin > Email log, where failed ones can be resent. "Sent" means Resend accepted it; delivery is shown in the Resend dashboard.

**Newsletters:** create a segment in Resend and put its ID in `RESEND_SEGMENT_ID`. New subscribers are copied into it (use "Send all to Resend" under Admin > Subscribers for existing ones). Write and send campaigns in Resend under Broadcasts, which handles unsubscribing there.

## Setting up the business in the dashboard

| Where | What to do |
|---|---|
| Settings | Contact email, name, address, phone, hours, home page text, booking rules, collection, mobile visits |
| Products | Photos, options (colour, length, texture, size) with their own price, sale price and stock |
| Delivery | Delivery choices, prices, free-over amounts, postcode limits |
| Discount codes | Percentage or fixed amount, dates, limits |
| Services | Price, duration, payment (salon, deposit fixed or %, full), salon or mobile, approval, extras, photos |
| Staff | Who offers what, who travels, weekly hours, holidays |
| Mobile areas | Postcode districts you travel to, with fee and journey time |
| Pages | Privacy, Terms, Delivery, Returns and Booking cancellation text |
| Blog, Gallery, FAQs | Your content |

Replace the sample products, services and staff, and **have the policy pages reviewed** for your business before launch.

## How booking and checkout work

- Nobody needs an account. Guests use the private links in their emails; signed-in customers also see everything in their account.
- Products can be bought alone, or added while booking and paid for in **one payment**. The shop bag can be carried into a booking.
- An unpaid checkout holds the time and stock for 35 minutes.
- Bookings that need approval (set per service, and all mobile visits by default) are requests: nothing is charged. When you approve, the customer is emailed a payment link.
- Cancelling an appointment refunds its online payment automatically when the customer is within the notice period. Products already paid for stay as an order.
- Outstanding balances can be recorded as cash, card reader or bank transfer, or sent as a payment link.
- Cash, card reader, bank and old Stripe payments can be marked as refunded, but you must return the money yourself.

## Things the site does by itself

While the server is running it checks every ten minutes and sends 24-hour reminders, frees abandoned checkouts and unanswered requests, sends one basket reminder to shoppers who asked, and makes a daily backup. No cron service is needed. If your host runs its own scheduler, set `DISABLE_SCHEDULER=1` and call:

```bash
curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain/api/cron/tasks
```

## Backups and your data

- Backups are saved in `backups/` (database and photos). Make one now with `npm run backup` or in Admin > Backups and exports.
- **They sit on the same server.** Copy them somewhere else regularly.
- To restore, stop the site and run `npm run restore -- <folder name> --yes`. This replaces the current data.
- Customers, orders, bookings, payments and subscribers can be exported as spreadsheets.
- Customers can download or delete their own account data. Newsletter and contact-form entries are matched by an email address the site has not verified, so they are only included in a download for verified addresses; handle those requests from the dashboard.

## Calendars

Admin > Backups and exports has a subscription link for all bookings, each staff profile has its own, and customers have one in their account. Add it in Google, Apple or Outlook calendar as "subscribe by URL". It is one way and may take a few hours to refresh.

## Cookies and analytics

Add a Google Analytics ID in Settings to switch on statistics. Google Analytics and maps load only for visitors who accept optional cookies. Private pages (admin, accounts, payment and manage links) are never measured.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build`, `npm start` | Production build and server |
| `npm run db:migrate` | Apply database updates |
| `npm run db:refresh-samples` | Replace untouched first-version sample items with hairdressing samples |
| `npm run create-admin` | Create or promote an administrator |
| `npm run backup`, `npm run restore` | Backups |
| `npm run typecheck`, `npm run lint`, `npm test` | Code checks and unit tests |
| `npm run test:integration` | Booking, stock and payment tests. Uses a separate `melare_test` database, with a stand-in for PayPal |
| `npm run db:generate` | Create a migration after editing `db/schema` |

For the integration tests, create the test database once:

```sql
CREATE DATABASE melare_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON melare_test.* TO 'melare_app'@'localhost';
```

## Hosting

- Use a host that runs a persistent Node.js server (VPS or similar), with MySQL 8 or MariaDB and `mysqldump` available.
- Use HTTPS. Set `NEXT_PUBLIC_SITE_URL` to the real address **before** building.
- Keep the `storage` folder (photos, including private customer photos) between deployments.
- Use new secrets and live keys.
- Put a reverse proxy in front that sets `X-Real-IP` to the visitor's address, overwriting anything the visitor sends. Rate limiting relies on it, and rate limits are held in memory, so run one instance.
- Keep software updated: run `npm outdated` and `npm audit` from time to time.
- XAMPP is for development only.

Everything is standard Node.js and MySQL, so the site can move to another host by copying the code, the database, `storage` and the environment file.

## Project layout

```
app/        pages and API routes ((site) is the public website, admin is the dashboard)
features/   business logic and server actions (checkout, payments, bookings, orders)
components/ shared UI
db/         schema, helpers for related rows, sample content
drizzle/    SQL migrations
lib/        auth, email, money, time, storage, backups and other helpers
scripts/    command line tools and database tests
```

Drizzle's relational query API (`db.query`) is deliberately not enabled: it produces SQL that MariaDB cannot run. Use the query builder, with the helpers in `db/relations.ts`.
