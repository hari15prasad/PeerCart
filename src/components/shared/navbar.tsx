"use client";

import Link from "next/link";
import { ShoppingBag, Sun, Moon, LogOut, User, Bell, PackageSearch, ChevronDown, MessageCircle, Trophy, CheckCheck, Receipt } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  email: string;
  full_name: string | null;
  avatar_url: string | null;
};

type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  listing_id: string | null;
  conversation_id: string | null;
  is_read: boolean;
  created_at: string;
};

export function Navbar() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const supabase = createClient();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const myListingIds = useRef<Set<string>>(new Set());
  const currentUserId = useRef<string | null>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      currentUserId.current = user.id;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("email, full_name, avatar_url")
        .eq("id", user.id)
        .single();
      if (profileData) setProfile(profileData);

      // Load notifications
      const { data: notifData } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (notifData) setNotifications(notifData as AppNotification[]);

      // Load my listing ids for legacy interest tracking
      const { data: myListings } = await supabase
        .from("listings").select("id").eq("seller_id", user.id);
      if (myListings?.length) {
        myListingIds.current = new Set(myListings.map((l: any) => l.id));
      }
    }

    load();

    // Realtime: subscribe to new notifications for this user
    const channel = supabase
      .channel("navbar-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const notif = payload.new as AppNotification;
          // Only add if it's for the current user
          if (notif.user_id === currentUserId.current || true) {
            // Re-fetch to get accurate data (filter happens server-side via RLS)
            supabase
              .from("notifications")
              .select("*")
              .eq("user_id", currentUserId.current!)
              .order("created_at", { ascending: false })
              .limit(20)
              .then(({ data }) => {
                if (data) setNotifications(data as AppNotification[]);
              });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setDropdownOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function markAllRead() {
    if (!currentUserId.current || unreadCount === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", currentUserId.current)
      .eq("is_read", false);
  }

  function handleNotifClick(notif: AppNotification) {
    setNotifOpen(false);
    // Mark this one as read
    if (!notif.is_read) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      supabase.from("notifications").update({ is_read: true }).eq("id", notif.id);
    }
    // Navigate to conversation or my listings
    if (notif.conversation_id) {
      router.push(`/chat/${notif.conversation_id}`);
    } else if (notif.type === 'new_request') {
      router.push("/my-listings");
    }
  }

  function timeAgo(ts: string) {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  const notifIconColor = (type: string) => {
    if (type === 'deal_accepted') return 'text-emerald-500';
    if (type === 'deal_rejected') return 'text-red-500';
    if (type === 'new_request') return 'text-blue-500';
    return 'text-amber-500';
  };

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() ?? "PC";

  const isDark = resolvedTheme === "dark";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <ShoppingBag className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <span className="text-xl font-bold tracking-tight">PeerCart</span>
        </Link>

        {profile && (
          <div className="flex items-center gap-2">
            <Link href="/leaderboard" className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors" title="Leaderboard">
              <Trophy className="h-5 w-5 text-amber-500 dark:text-amber-400" />
            </Link>

            <Link href="/chats" className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors" title="Messages">
              <MessageCircle className="h-5 w-5 text-slate-500 dark:text-zinc-400" />
            </Link>

            {/* Notification Bell with Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setNotifOpen(prev => !prev); if (!notifOpen) markAllRead(); }}
                className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                title="Notifications"
              >
                <Bell className="h-5 w-5 text-slate-500 dark:text-zinc-400" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">Notifications</p>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] text-blue-500 font-semibold hover:underline">
                        <CheckCheck className="h-3 w-3" /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-slate-400 dark:text-zinc-500 text-sm">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((notif: AppNotification) => (
                        <button
                          key={notif.id}
                          onClick={() => handleNotifClick(notif)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex gap-3 items-start ${!notif.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                        >
                          <div className={`mt-0.5 text-lg flex-shrink-0 ${notifIconColor(notif.type)}`}>
                            {notif.type === 'deal_accepted' && '🎉'}
                            {notif.type === 'deal_rejected' && '❌'}
                            {notif.type === 'new_request' && '🛎️'}
                            {notif.type === 'deal_cancelled' && '↩️'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white text-xs">{notif.title}</p>
                            <p className="text-slate-500 dark:text-zinc-400 text-xs mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-slate-400 dark:text-zinc-500 text-[10px] mt-1">{timeAgo(notif.created_at)}</p>
                          </div>
                          {!notif.is_read && (
                            <span className="flex-shrink-0 h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <div className="border-t border-slate-100 dark:border-zinc-800">
                      <button
                        onClick={() => { setNotifOpen(false); router.push("/my-listings"); }}
                        className="w-full py-2.5 text-xs font-semibold text-blue-500 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        View all in My Listings →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Custom Avatar Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-full ring-2 ring-transparent hover:ring-blue-500 transition-all outline-none p-0.5"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-blue-600 text-white font-bold text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
                    <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{profile.full_name || "Student"}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{profile.email}</p>
                  </div>

                  <div className="py-1">
                    <button onClick={() => { setDropdownOpen(false); router.push("/profile"); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                      <User className="h-4 w-4" /> Profile & Settings
                    </button>

                    <button onClick={() => { setDropdownOpen(false); router.push("/my-listings"); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                      <PackageSearch className="h-4 w-4" /> My Listings
                    </button>

                    <button onClick={() => { setDropdownOpen(false); router.push("/transactions"); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                      <Receipt className="h-4 w-4" /> Transactions
                    </button>
                  </div>

                  <div className="px-4 py-2.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
                      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                      {isDark ? "Dark Mode" : "Light Mode"}
                    </div>
                    <Switch checked={isDark} onCheckedChange={(val) => setTheme(val ? "dark" : "light")} />
                  </div>

                  <div className="border-t border-slate-100 dark:border-zinc-800 py-1">
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                      <LogOut className="h-4 w-4" /> Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
