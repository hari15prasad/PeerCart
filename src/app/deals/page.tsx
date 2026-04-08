"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/shared/navbar";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Package, Clock, CheckCircle2, XCircle, Receipt, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Deal = {
  id: string;
  listing_id: string;
  buyer_id: string;
  status: 'Pending' | 'Confirmed' | 'Cancelled';
  created_at: string;
  listings: {
    title: string;
    price: number;
    category: string;
    image_url: string | null;
    status: string;
    profiles: {
      full_name: string | null;
      email: string;
    }
  }
};

export default function MyDealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchDeals() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("interests")
        .select(`
          id, listing_id, buyer_id, status, created_at,
          listings (
            title, price, category, image_url, status,
            profiles:seller_id (full_name, email)
          )
        `)
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setDeals(data as any);
      }
      setIsLoading(false);
    }
    fetchDeals();
  }, [router, supabase]);

  const getStatusBadge = (status: string, listingStatus: string) => {
    if (status === 'Confirmed') {
      return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Accepted</Badge>;
    }
    if (status === 'Cancelled' || (listingStatus === 'Sold' && status !== 'Confirmed')) {
      return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-none flex items-center gap-1"><XCircle className="h-3 w-3" /> Declined</Badge>;
    }
    return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-none flex items-center gap-1 animate-pulse"><Clock className="h-3 w-3" /> Pending</Badge>;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Package className="h-8 w-8 text-blue-600" />
            My Offers
          </h1>
          <p className="mt-1 text-slate-600 dark:text-zinc-400">Track items you've offered to buy and their status.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-24 bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
            <Package className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-zinc-700" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No offers yet</h3>
            <p className="text-sm text-slate-500 dark:text-zinc-500 mt-1">Browse the feed and find something you like!</p>
            <Button onClick={() => router.push("/")} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8">
              Browse Marketplace
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {deals.map((deal) => (
              <div key={deal.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 shadow-sm hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group">
                {/* Product Image */}
                <div className="w-24 h-24 sm:w-20 sm:h-20 rounded-xl bg-slate-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden flex items-center justify-center border border-slate-100 dark:border-zinc-800">
                  {deal.listings?.image_url ? (
                    <img src={deal.listings.image_url} alt={deal.listings.title} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-8 w-8 text-slate-300 dark:text-zinc-600" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-slate-900 dark:text-white truncate pr-2">{deal.listings?.title}</h3>
                      <div className="shrink-0">{getStatusBadge(deal.status, deal.listings?.status)}</div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                      Seller: <span className="font-medium text-slate-700 dark:text-zinc-300">{deal.listings?.profiles?.full_name || deal.listings?.profiles?.email}</span>
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-lg font-black text-slate-900 dark:text-white">₹{deal.listings?.price}</div>
                    <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                      {new Date(deal.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-zinc-800 pt-3 sm:pt-0 sm:pl-4 flex sm:flex-col justify-center gap-2 shrink-0 min-w-[120px]">
                  {deal.status === 'Confirmed' ? (
                    <Button 
                      size="sm" 
                      onClick={() => router.push("/transactions")}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold"
                    >
                      <Receipt className="h-3.5 w-3.5 mr-1.5" /> View Receipt
                    </Button>
                  ) : (
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/")}
                      className="w-full rounded-full text-xs text-slate-600 dark:text-zinc-400 hover:text-blue-600 hover:border-blue-600 transition-all"
                    >
                      More Like This <ArrowRight className="h-3.5 w-3.5 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
