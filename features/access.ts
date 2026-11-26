import "server-only";
import { getBooking } from "@/features/bookings/service";
import { getOrder } from "@/features/orders/service";
import { getPayment } from "@/features/payments/ledger";
import { getOptionalUser } from "@/lib/session";
import { parseTokenId, verifyToken } from "@/lib/tokens";

/**
 * How a customer proves a record is theirs: a private link token (guests),
 * or an id belonging to the signed-in account.
 */
export type Access = { token: string } | { id: number };

type Owned = { id: number; tokenNonce: string; userId: string | null };

async function resolve<T extends Owned>(
  kind: "booking" | "order",
  access: Access,
  load: (id: number) => Promise<T | undefined>,
): Promise<T | null> {
  // Values arrive from the network, so check their types before use.
  if ("token" in access) {
    if (typeof access.token !== "string") return null;
    const id = parseTokenId(access.token);
    if (!id) return null;
    const record = await load(id);
    return record && verifyToken(kind, access.token, record) ? record : null;
  }
  if (!Number.isInteger(access.id) || access.id <= 0) return null;
  const user = await getOptionalUser();
  if (!user) return null;
  const record = await load(access.id);
  return record && record.userId === user.id ? record : null;
}

/** Payment links are only ever opened by their signed token. */
export async function accessPayment(token: string) {
  if (typeof token !== "string") return null;
  const id = parseTokenId(token);
  if (!id) return null;
  const payment = await getPayment(id);
  return payment && verifyToken("payment", token, payment) ? payment : null;
}

export const accessBooking = (access: Access) => resolve("booking", access, getBooking);
export const accessOrder = (access: Access) => resolve("order", access, getOrder);
