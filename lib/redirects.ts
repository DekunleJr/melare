/** Only allow same-site relative paths as a post-sign-in destination. */
export function safeNext(value: string | string[] | null | undefined, fallback = "/account") {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(next)) {
    return fallback;
  }
  return next;
}
