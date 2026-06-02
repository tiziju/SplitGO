"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/groups");
    else router.replace("/login");
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F6FA]">
      <div className="w-8 h-8 border-2 border-[#bae8e8] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
