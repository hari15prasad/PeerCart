"use client";

import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/shared/navbar";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { ListingAssistant } from "@/components/assistant/ListingAssistant";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const CATEGORIES = ["All", "Books", "Lab Coat", "Electronics", "Stationery", "Other"];

type Listing = {
  id: string;
  title: string;
  price: number;
  condition: string;
  category: string;
  image_url?: string;
  status: string;
  seller_id: string;
  profiles: {
    email: string;
    full_name: string | null;
    student_year: number | null;
    branch: string | null;
  };
};

export default function HomeFeed() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const supabase = createClient();

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    let query = supabase
      .from("listings")
      .select("*, profiles(email, full_name, student_year, branch)")
      .eq("status", "Available")
      .order("created_at", { ascending: false });

    if (activeCategory !== "All") {
      query = query.eq("category", activeCategory);
    }
    
    if (submittedQuery.trim()) {
      query = query.ilike("title", `%${submittedQuery.trim()}%`);
    }

    const { data, error } = await query;
    if (!error && data) {
      setListings(data as any);
      
      // Auto-Demand Silently
      if (data.length === 0 && submittedQuery.trim() && currentUserId) {
        // Prevent duplicate spam by checking if it already exists
        const { count } = await supabase.from("demand_alerts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", currentUserId)
          .eq("item_keyword", submittedQuery.trim());
          
        if (count === 0) {
          await supabase.from("demand_alerts").insert({
            user_id: currentUserId,
            item_keyword: submittedQuery.trim(),
            category: activeCategory !== "All" ? activeCategory : "Other"
          });
        }
      }
    }
    setIsLoading(false);
  }, [activeCategory, submittedQuery, currentUserId, supabase]);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    }
    getUser();
    fetchListings();
  }, [fetchListings, supabase]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Campus Feed
          </h1>
          <p className="mt-1 text-slate-600 dark:text-zinc-400">
            Find what you need this semester, from seniors you trust.
          </p>
        </div>

        {/* Search Bar */}
        <form 
          className="relative mb-6 max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmittedQuery(searchQuery);
          }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input 
            type="text" 
            placeholder="Search textbooks, lab coats, electronics..." 
            className="pl-10 h-12 rounded-2xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 focus-visible:ring-blue-500 shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="hidden">Submit</button>
        </form>

        {/* Category Filters */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 hide-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Feed Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-24 text-slate-400 dark:text-zinc-500">
            <p className="text-lg font-medium">No listings found.</p>
            {submittedQuery.trim() ? (
              <p className="text-sm mt-1 text-blue-500 font-medium">We securely tracked your search intent. We'll notify you if someone posts it!</p>
            ) : (
              <p className="text-sm mt-1">Be the first! Click the + button to post something.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                id={listing.id}
                title={listing.title}
                price={listing.price}
                condition={listing.condition}
                category={listing.category}
                image_url={listing.image_url}
                status={listing.status}
                seller_id={listing.seller_id}
                sellerEmail={listing.profiles?.email}
                sellerYear={listing.profiles?.student_year ?? undefined}
                sellerBranch={listing.profiles?.branch ?? undefined}
                currentUserId={currentUserId}
                onDelete={() => fetchListings()}
              />
            ))}
          </div>
        )}

        <ListingAssistant onPublished={fetchListings} />
      </main>
    </div>
  );
}
