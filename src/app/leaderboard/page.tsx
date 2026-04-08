"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/shared/navbar";
import { createClient } from "@/lib/supabase/client";
import { Trophy, Leaf, IndianRupee, HandHeart, Zap, Package, Crown, Loader2, Medal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type LeaderboardUser = {
  user_id: string;
  display_name: string;
  score: number;
};

type TabId = "eco_score" | "seller_score" | "helper_score" | "responder_score" | "declutter_score";

const TABS: { id: TabId; label: string; icon: React.ElementType; color: string; unit: string; desc: string }[] = [
  { id: "eco_score", label: "Eco Saver", icon: Leaf, color: "text-emerald-500", unit: "pts", desc: "Based on items reused & estimated waste reduced." },
  { id: "seller_score", label: "Top Seller", icon: IndianRupee, color: "text-amber-500", unit: "₹", desc: "Ranked by total sales value." },
  { id: "helper_score", label: "Campus Helper", icon: HandHeart, color: "text-rose-500", unit: "txn", desc: "Number of successful peer transactions." },
  { id: "responder_score", label: "Fast Responder", icon: Zap, color: "text-blue-500", unit: "chats", desc: "Most active conversations and repliers." },
  { id: "declutter_score", label: "Declutter Pro", icon: Package, color: "text-purple-500", unit: "items", desc: "Total community listings created." },
];

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("eco_score");
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const { data, error } = await supabase.rpc("get_leaderboard", {
        category: activeTab,
        limit_val: 20
      });
      
      if (data) {
        setUsers(data as LeaderboardUser[]);
      } else if (error) {
        console.error("Leaderboard Error:", error.message);
      }
      setIsLoading(false);
    }
    load();
  }, [activeTab, supabase]);

  const top3 = users.slice(0, 3);
  const rest = users.slice(3);
  
  const currentRankIndex = users.findIndex(u => u.user_id === currentUserId);
  const currentRank = currentRankIndex >= 0 ? currentRankIndex + 1 : null;

  const getInitials = (name?: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2) : "?";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl flex-1 flex flex-col">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-3 flex items-center justify-center gap-3">
            <Trophy className="h-8 w-8 text-amber-500" />
            Impact Leaderboard
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 max-w-lg mx-auto">
            See who's making the biggest impact on campus this week. Rank up by selling, donating, and helping peers!
          </p>
        </div>

        {/* Tabs - Scrollable horizontally on small screens */}
        <div className="flex overflow-x-auto pb-4 mb-6 gap-2 snap-x hide-scrollbar">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex whitespace-nowrap items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all snap-start ${
                  isActive 
                  ? "bg-slate-900 text-white dark:bg-white dark:text-black shadow-md scale-105" 
                  : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "" : tab.color}`} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Podium Area + Rest of List */}
        <div className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden backdrop-blur-xl">
          {/* Subtle heavy glassmorphic background blob */}
          <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-blue-500/10 to-transparent -z-10 pointer-events-none rounded-t-3xl" />
          
          <div className="text-center mb-10">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 italic">
              {TABS.find(t => t.id === activeTab)?.desc}
            </p>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-blue-500">
              <Loader2 className="h-10 w-10 animate-spin mb-4" />
              <p className="font-bold text-slate-900 dark:text-white">Loading Ranks...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-20 text-slate-400 dark:text-zinc-500">
              <Trophy className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <h2 className="text-xl font-bold mb-2">No activity yet</h2>
              <p>Be the first to hit the boards this week!</p>
            </div>
          ) : (
            <div className="space-y-12">
              {/* PODIUM (Top 3) */}
              <div className="flex items-end justify-center gap-2 sm:gap-6 pt-10">
                {/* 2nd Place */}
                {top3[1] && (
                  <div className="flex flex-col items-center animate-in slide-in-from-bottom h-full duration-500 delay-100 flex-1">
                    <p className="font-bold text-slate-700 dark:text-slate-300 mb-2 truncate max-w-[80px] sm:max-w-xs text-center text-xs sm:text-base">
                      {top3[1].display_name.split(" ")[0]}
                    </p>
                    <div className="bg-gradient-to-t from-slate-200 to-slate-50 dark:from-zinc-800 dark:to-zinc-900 border border-slate-300 dark:border-zinc-700 w-full sm:w-28 rounded-t-2xl shadow-inner flex flex-col items-center pt-4 pb-2 h-32 relative">
                      <Avatar className="h-12 w-12 border-4 border-white dark:border-zinc-900 shadow-md absolute -top-8 bg-slate-300">
                        <AvatarFallback className="font-black text-slate-600">{getInitials(top3[1].display_name)}</AvatarFallback>
                      </Avatar>
                      <Medal className="h-6 w-6 text-slate-400 mb-1 mt-3" />
                      <span className="font-black text-xl text-slate-800 dark:text-white">{activeTab === 'seller_score' && '₹'}{top3[1].score}</span>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">{TABS.find(t=>t.id===activeTab)?.unit}</span>
                    </div>
                  </div>
                )}
                
                {/* 1st Place */}
                <div className="flex flex-col items-center animate-in slide-in-from-bottom duration-500 flex-1 z-10 w-full">
                  <p className="font-black text-amber-500 dark:text-amber-400 mb-2 truncate max-w-[90px] sm:max-w-xs text-center text-sm sm:text-lg">
                    {top3[0].display_name.split(" ")[0]}
                  </p>
                  <div className="bg-gradient-to-t from-amber-200 to-amber-50 dark:from-amber-900/60 dark:to-amber-950/30 border border-amber-300 dark:border-amber-700/50 w-full sm:w-32 rounded-t-2xl shadow-xl flex flex-col items-center pt-4 pb-2 h-40 relative scale-105">
                    <Crown className="absolute -top-14 h-8 w-8 text-amber-500 drop-shadow-md z-20" />
                    <Avatar className="h-16 w-16 border-4 border-amber-400 shadow-lg absolute -top-8 bg-amber-100">
                      <AvatarFallback className="font-black text-amber-700 text-xl">{getInitials(top3[0].display_name)}</AvatarFallback>
                    </Avatar>
                    <span className="font-black text-3xl text-amber-900 dark:text-amber-100 mt-6">{activeTab === 'seller_score' && '₹'}{top3[0].score}</span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase font-bold">{TABS.find(t=>t.id===activeTab)?.unit}</span>
                  </div>
                </div>

                {/* 3rd Place */}
                {top3[2] && (
                  <div className="flex flex-col items-center animate-in slide-in-from-bottom duration-500 delay-200 flex-1">
                    <p className="font-bold text-amber-700 dark:text-amber-600 mb-2 truncate max-w-[80px] sm:max-w-xs text-center text-xs sm:text-base">
                      {top3[2].display_name.split(" ")[0]}
                    </p>
                    <div className="bg-gradient-to-t from-orange-200 to-orange-50 dark:from-amber-950/40 dark:to-zinc-900 border border-orange-300 dark:border-amber-900/40 w-full sm:w-28 rounded-t-2xl shadow-inner flex flex-col items-center pt-4 pb-2 h-24 relative">
                      <Avatar className="h-10 w-10 border-4 border-white dark:border-zinc-900 shadow-md absolute -top-6 bg-orange-200">
                        <AvatarFallback className="font-black text-orange-800 text-sm">{getInitials(top3[2].display_name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-black text-lg text-orange-950 dark:text-orange-200 mt-4">{activeTab === 'seller_score' && '₹'}{top3[2].score}</span>
                      <span className="text-[10px] text-orange-800/60 dark:text-orange-500/60 uppercase font-bold">{TABS.find(t=>t.id===activeTab)?.unit}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* LIST (4th and below) */}
              {rest.length > 0 && (
                <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-zinc-800">
                  {rest.map((user, idx) => (
                    <div 
                      key={user.user_id} 
                      className={`flex items-center gap-4 p-3 sm:p-4 rounded-2xl transition-colors ${
                        user.user_id === currentUserId 
                        ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50" 
                        : "bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="w-6 sm:w-8 font-black text-slate-400 dark:text-zinc-500 text-center text-sm sm:text-base">
                        #{idx + 4}
                      </div>
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-sm">
                          {getInitials(user.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white truncate text-sm sm:text-base">
                          {user.display_name} {user.user_id === currentUserId && "(You)"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-900 dark:text-white text-base sm:text-lg">
                          {activeTab === 'seller_score' && '₹'}{user.score}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">{TABS.find(t=>t.id===activeTab)?.unit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CURRENT USER STICKY BAR */}
        {!isLoading && currentUserId && (
          <div className="mt-6 sticky bottom-4">
            <div className="bg-slate-900 dark:bg-zinc-100 text-white dark:text-black rounded-2xl p-4 shadow-2xl flex items-center justify-between border border-slate-800 dark:border-slate-300">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 text-white h-10 w-10 rounded-full flex items-center justify-center font-black shadow-inner">
                  {currentRank ? `#${currentRank}` : "-"}
                </div>
                <div>
                  <p className="font-bold text-sm sm:text-base">Your Weekly Rank</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {currentRank ? `You are #${currentRank} in ${TABS.find(t=>t.id===activeTab)?.label}!` : "Make a transaction to rank up!"}
                  </p>
                </div>
              </div>
              <div className="text-right pl-4 border-l border-slate-700 dark:border-slate-300">
                <p className="font-black text-xl">
                  {activeTab === 'seller_score' && '₹'}{currentRank ? users[currentRank - 1].score : 0}
                </p>
                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">{TABS.find(t=>t.id===activeTab)?.unit}</p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
