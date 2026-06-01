"use client";

let liffInitialized = false;

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export async function initLiff(): Promise<void> {
  if (liffInitialized) return;
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId || liffId === "your-liff-id-here") return; // Dev mode: skip real LIFF

  const liff = (await import("@line/liff")).default;
  await liff.init({ liffId });
  liffInitialized = true;
}

export async function getLiffProfile(): Promise<LiffProfile | null> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId || liffId === "your-liff-id-here") return null; // Dev: use mock

  try {
    const liff = (await import("@line/liff")).default;
    if (!liff.isLoggedIn()) return null;
    const profile = await liff.getProfile();
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
    };
  } catch {
    return null;
  }
}

export async function liffLogin(): Promise<void> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId || liffId === "your-liff-id-here") return;
  const liff = (await import("@line/liff")).default;
  liff.login();
}
