import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "./auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
};

/** The signed-in user, or null for guests and disabled accounts. */
export const getOptionalUser = cache(async (): Promise<SessionUser | null> => {
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session || session.user.disabled) return null;
  const { id, name, email, role } = session.user;
  return { id, name, email, role: role === "admin" ? "admin" : "customer" };
});

export async function requireUser(next = "/account"): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return user;
}

/** Call in every admin page, query, action and route handler. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  // Customers get a 404 so the admin area is not advertised.
  if (user.role !== "admin") notFound();
  return user;
}
