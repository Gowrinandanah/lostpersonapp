// src/constants/adminConfig.ts
// ─── Single source of truth for admin access ──────────────────────────────

import { getDocument } from "../firebase/firestoreService";

/** Hard-coded fallback so the bootstrap admin can always get in,
 *  even before their Firestore doc is seeded. */
export const ADMIN_EMAILS: string[] = ["lunyx599@gmail.com"];

/** Fast synchronous check used as a first-pass guard. */
export const isAdminEmail = (email: string | null | undefined): boolean =>
  ADMIN_EMAILS.includes((email ?? "").toLowerCase().trim());

/**
 * Authoritative async check.
 * Returns true if:
 *   • the email is in ADMIN_EMAILS, OR
 *   • the user's Firestore /users/{uid} document has role === "admin"
 *
 * Use this wherever you need to honour roles promoted via the admin UI.
 */
export const checkIsAdmin = async (
  uid: string,
  email: string | null | undefined
): Promise<boolean> => {
  if (isAdminEmail(email)) return true;
  try {
    const profile = await getDocument("users", uid);
    return (profile as any)?.role === "admin";
  } catch {
    return false;
  }
};