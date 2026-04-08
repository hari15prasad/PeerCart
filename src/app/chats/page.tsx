"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/shared/navbar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MessageCircle } from "lucide-react";

type Conversation = {
  id: string;
  created_at: string;
  listings: { title: string };
  buyer: { id: string; email: string; full_name: string | null };
  seller: { id: string; email: string; full_name: string | null };
};

export default function ChatsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("conversations")
        .select("*, listings(title), buyer:buyer_id(id,email,full_name), seller:seller_id(id,email,full_name)")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (data) setConversations(data as any);
      setIsLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-lg">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-6">Messages</h1>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-20 text-slate-400 dark:text-zinc-500">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No conversations yet.</p>
            <p className="text-sm mt-1">Click "I want this" on any listing to start a chat.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => {
              const other = userId === (conv.buyer as any).id ? conv.seller : conv.buyer;
              const initials = (other as any).full_name
                ?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                ?? (other as any).email.slice(0, 2).toUpperCase();
              return (
                <button
                  key={conv.id}
                  onClick={() => router.push(`/chat/${conv.id}`)}
                  className="w-full flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-left"
                >
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className="bg-blue-600 text-white font-bold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{(other as any).full_name || (other as any).email}</p>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 truncate">re: {(conv.listings as any)?.title}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
