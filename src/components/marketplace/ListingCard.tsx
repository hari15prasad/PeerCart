"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { BookOpen, Loader2, Mail, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ListingCardProps = {
  id: string;
  title: string;
  price: number;
  condition: string;
  category: string;
  image_url?: string;
  status?: string;
  seller_id: string;
  sellerYear?: number;
  sellerBranch?: string;
  sellerEmail?: string;
  currentUserId?: string | null;
  onDelete?: () => void;
};

export function ListingCard({
  id, title, price, condition, category,
  image_url, status = "Available", seller_id, sellerYear, sellerBranch, sellerEmail,
  currentUserId, onDelete
}: ListingCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [fairPriceAvg, setFairPriceAvg] = useState<number | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadFairDeal() {
      // Fetch historical fair price for this category
      const { data, error } = await supabase.rpc("get_fair_price", { item_category: category });
      if (!error && data !== null && data > 0) {
        setFairPriceAvg(data as number);
      }
    }
    loadFairDeal();
  }, [category, supabase]);

  const conditionColor =
    condition === "New" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
    condition === "Good" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
    "bg-amber-500/10 text-amber-600 dark:text-amber-400";

  let dealBadge = null;
  if (fairPriceAvg && price > 0) {
    if (price < fairPriceAvg * 0.8) {
      dealBadge = <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none text-[10px] sm:text-xs">🟢 Great Deal</Badge>;
    } else if (price >= fairPriceAvg * 0.8 && price <= fairPriceAvg * 1.2) {
      dealBadge = <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-none text-[10px] sm:text-xs">🟡 Fair Price</Badge>;
    } else {
      dealBadge = <Badge className="bg-rose-500 hover:bg-rose-600 text-white border-none text-[10px] sm:text-xs">🔴 Overpriced</Badge>;
    }
  }

  async function handleInterest() {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert("Please log in to express interest."); setIsLoading(false); return; }

    if (user.id === seller_id) {
      alert("This is your own listing!"); setIsLoading(false); return;
    }

    // Fire lifecycle RPC as a side-effect (non-blocking)
    // This marks listing as Pending and upserts the interest record
    supabase.rpc("manage_order_lifecycle", {
      target_listing_id: id,
      target_buyer_id: user.id,
      action_type: "START_PURCHASE"
    }).then(({ error }) => {
      if (error) {
        // Fallback: insert interest directly if RPC fails
        supabase.from("interests").insert({ listing_id: id, buyer_id: user.id });
      }
    });

    // Always find or create conversation and navigate to it
    try {
      // 1. Try to find existing conversation first
      let { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("listing_id", id)
        .eq("buyer_id", user.id)
        .maybeSingle(); // maybeSingle returns null (not error) if no rows

      // 2. If none found, create one
      if (!conv) {
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert({ listing_id: id, buyer_id: user.id, seller_id: seller_id })
          .select("id")
          .single();

        if (convError) {
          // Unique conflict means it was just created — fetch it
          const { data: refetched } = await supabase
            .from("conversations")
            .select("id")
            .eq("listing_id", id)
            .eq("buyer_id", user.id)
            .maybeSingle();
          conv = refetched;
        } else {
          conv = newConv;
        }
      }

      if (conv?.id) {
        router.push(`/chat/${conv.id}`);
      } else {
        alert("Could not open chat. Please try again.");
        setIsLoading(false);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    setIsLoading(true);
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) {
      alert("Failed to delete: " + error.message);
      setIsLoading(false);
    } else {
      if (onDelete) onDelete();
    }
  }

  return (
    <Card className="overflow-hidden border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Image */}
      <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center border-b border-slate-100 dark:border-zinc-800 overflow-hidden">
        {image_url ? (
          <img src={image_url} alt={title} className="w-full h-full object-cover" />
        ) : (
          <BookOpen className="h-10 w-10 text-slate-300 dark:text-zinc-600" />
        )}
      </div>

      <CardContent className="p-4 flex-1">
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="flex flex-wrap gap-1.5 items-center">
            {status === "Pending" && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none font-bold text-[10px] rounded-sm uppercase tracking-wider">
                In Progress
              </Badge>
            )}
            <Badge variant="outline" className={`${conditionColor} border-none font-semibold px-2 py-0.5 rounded-sm text-xs`}>
              {condition}
            </Badge>
            
            {/* Fair Deal Tooltip */}
            {dealBadge && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger>
                    {dealBadge}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Based on market demand, similar items sell for around ₹{Math.round(fairPriceAvg || 0)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 dark:text-zinc-400 hidden sm:inline">{category}</span>
            {currentUserId === seller_id && (
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                title="Delete Listing"
              >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
        <h3 className="font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight mb-1">{title}</h3>
        <div className="text-xs text-slate-500 dark:text-zinc-400 mb-3">
          Year {sellerYear || "?"} • {sellerBranch || "Unknown"}
        </div>
        <div className="text-xl font-black text-slate-900 dark:text-white">₹{price}</div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex flex-col gap-2">
        {status === "Available" ? (
          <Button
            onClick={handleInterest}
            disabled={isLoading || currentUserId === seller_id}
            className="w-full font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl"
          >
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "I want this"}
          </Button>
        ) : (
          <Button
            onClick={() => router.push("/chats")}
            disabled={isLoading}
            variant="secondary"
            className="w-full font-bold rounded-xl"
          >
            Check Orders
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
