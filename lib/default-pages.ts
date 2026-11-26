/*
 * Starting text for the information pages. The owner edits them under
 * Admin > Pages. {placeholders} are filled from Settings. This wording is a
 * starting point and should be reviewed for the business before going live.
 */
export const PAGE_SLUGS = [
  "privacy",
  "terms",
  "delivery",
  "returns",
  "cancellation-policy",
] as const;

export type PageSlug = (typeof PAGE_SLUGS)[number];

export const defaultPages: Record<PageSlug, { title: string; body: string }> = {
  privacy: {
    title: "Privacy notice",
    body: `## What we collect
When you book, order, contact us or create an account, {businessName} collects the details you give us: your name, email, phone number, address, booking notes and any reference photos you upload.

## How we use it
We use these details to provide your appointment or order, take payment, send confirmations and reminders, answer your questions and keep the records the law requires. We send marketing email only if you ask for it, and a basket reminder only if you tick the box at checkout.

## Who we share it with
- PayPal processes payments. We never see or store your card number.
- Resend delivers our email.
- Our hosting provider stores the website and its data.
- If you accept optional cookies, Google provides visitor statistics and maps.

We do not sell your data.

## How long we keep it
Order and payment records are kept as long as accounting law requires. Saved baskets are deleted after 30 days.

## Cookies
We use cookies needed to keep you signed in and to remember your cookie choice. Your shopping bag is stored in your own browser. Google Analytics and Google Maps are used only if you accept optional cookies, which you can change at any time using "Cookie settings" at the foot of the page. PayPal sets its own cookies on payment pages.

## Your rights
You can download your data or delete your account from your account profile, unsubscribe using the link in any marketing email, or ask us to see, correct or delete your data: [contact us](/contact). You can also complain to the Information Commissioner's Office at [ico.org.uk](https://ico.org.uk).`,
  },
  terms: {
    title: "Terms and conditions",
    body: `## Appointments
Bookings are subject to our [booking cancellation policy](/cancellation-policy). Some requests, including some mobile appointments, are confirmed only after we approve them and you pay any amount due.

## Prices and payment
Prices are in pounds sterling and include VAT where it applies. Online payments are processed by PayPal.

## Products
Delivery and returns are described on our [delivery](/delivery) and [returns](/returns) pages.

## Contact
{businessName}
{address}
{publicEmail}
{phone}`,
  },
  delivery: {
    title: "Delivery",
    body: `## Delivery options
The options and prices available for your postcode are shown at checkout before you pay.

## Collection
{pickupInstructions}

## With your appointment
Products bought while booking can be collected at your salon appointment, or brought by your stylist to a mobile appointment.

## Problems
If your order has not arrived when expected, [contact us](/contact) with your order number.`,
  },
  returns: {
    title: "Returns and refunds",
    body: `## Changing your mind
You have 14 days from receiving goods bought online to tell us you want to return them, and a further 14 days to send them back.

## Hygiene
For hygiene reasons, hair extensions and opened hair care products cannot be returned once the seal is broken, unless they are faulty.

## Faulty items
If something is faulty or not as described, [contact us](/contact). Your statutory rights are not affected.

## Refunds
Refunds go back to the way you paid, usually within 5 to 10 working days of us receiving the return.`,
  },
  "cancellation-policy": {
    title: "Booking cancellation policy",
    body: `{cancellationPolicy}

## Notice period
You can cancel or reschedule online up to {cancellationNoticeHours} hours before your appointment. Eligible online payments are then refunded automatically.

## Requests awaiting approval
You can withdraw a request at any time before it is approved, and nothing is charged.

## Products
Cancelling an appointment does not cancel products you have already paid for. [Contact us](/contact) if you need help with them.`,
  },
};

export function fillPlaceholders(body: string, values: Record<string, string | number>): string {
  return body
    .replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : whole))
    .replace(/\n{3,}/g, "\n\n");
}
