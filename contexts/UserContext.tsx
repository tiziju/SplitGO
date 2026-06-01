"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface CurrentUser {
  id: string;
  lineUserId: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface UserContextValue {
  user: CurrentUser | null;
  setUser: (u: CurrentUser | null) => void;
  loading: boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  setUser: () => {},
  loading: true,
});

const STORAGE_KEY = "splitgo_user";

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUserState(JSON.parse(raw));
    } catch {}
    setLoading(false);
  }, []);

  const setUser = (u: CurrentUser | null) => {
    setUserState(u);
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
