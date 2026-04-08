"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/shared/navbar";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, Loader2, Users, Trash, MessageCircle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";

type MyListing = {
  id: string;
  title: string;
  price: number;
  condition: string;
  category: string;
  image_url?: string;
  status: string;
  created_at: string;
  interests: { buyer_id: string; status: string; profiles: { email: string; full_name: string | null } }[];
};

export default function MyListingsPage() {
  const [listings, setListings] = useState<MyListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{
    listingId: string;
    listingTitle: string;
    buyerId: string;
    buyerName: string;
    price: number;
  } | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchMyListings() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("listings")
        .select("*, interests(buyer_id, status, profiles(email, full_name))")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) setListings(data as any);
      setIsLoading(false);
    }
    fetchMyListings();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    
    // Optimistic remove
    setListings((prev) => prev.filter((l) => l.id !== id));
    
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) {
      alert("Failed to delete: " + error.message);
      // Re-fetch to restore if failed
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("listings")
          .select("*, interests(buyer_id, profiles(email, full_name))")
          .eq("seller_id", user.id)
          .order("created_at", { ascending: false });
        if (data) setListings(data as any);
      }
    }
  }

  async function handleStartChat(listingId: string, buyerId: string) {
    setIsLoading(true);
    let { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .eq("buyer_id", buyerId)
      .single();

    if (!conv) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          listing_id: listingId,
          buyer_id: buyerId,
          seller_id: user.id
        })
        .select()
        .single();
      conv = newConv;
    }
    
    if (conv) {
      router.push(`/chat/${conv.id}`);
    } else {
      setIsLoading(false);
    }
  }

  async function handleOrderAction(listingId: string, buyerId: string, action: string) {
    if (action === 'CONFIRM_SALE') {
      // Find listing details for modal
      const listing = listings.find(l => l.id === listingId);
      const interest = listing?.interests.find(i => i.buyer_id === buyerId);
      if (listing && interest) {
        setConfirmModal({
          listingId,
          listingTitle: listing.title,
          buyerId,
          buyerName: interest.profiles?.full_name || interest.profiles?.email || 'Buyer',
          price: listing.price
        });
      }
      return; // Wait for modal confirmation
    }
    await executeOrderAction(listingId, buyerId, action);
  }

  async function executeOrderAction(listingId: string, buyerId: string, action: string) {
    const { data: success, error } = await supabase.rpc("manage_order_lifecycle", {
      target_listing_id: listingId,
      target_buyer_id: buyerId,
      action_type: action
    });
    if (success) {
      setListings(prev => prev.map(l => {
        if (l.id !== listingId) return l;
        const newStatus = action === 'CONFIRM_SALE' ? 'Sold' : 'Available';
        const updatedInterests = l.interests.map(i =>
          i.buyer_id === buyerId
            ? { ...i, status: action === 'CONFIRM_SALE' ? 'Confirmed' : 'Cancelled' }
            : i
        );
        return { ...l, status: newStatus, interests: updatedInterests };
      }));
    } else {
      alert("Action failed: " + (error?.message || "Unknown error"));
    }
  }

  const conditionColor = (c: string) =>
    c === "New" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
    c === "Good" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
    "bg-amber-500/10 text-amber-600 dark:text-amber-400";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">My Listings</h1>
          <p className="mt-1 text-slate-600 dark:text-zinc-400">Items you're selling and who wants them.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-24 text-slate-400 dark:text-zinc-500">
            <p className="text-lg font-medium">You haven't listed anything yet.</p>
            <p className="text-sm mt-1">Go to the feed and click the + button to sell something!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {listings.map((listing) => (
              <div key={listing.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex gap-4 shadow-sm">
                {/* Image */}
                <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {listing.image_url ? (
                    <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="h-7 w-7 text-slate-300 dark:text-zinc-600" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1 gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                       <h3 className="font-bold text-slate-900 dark:text-white truncate">{listing.title}</h3>
                       <Badge variant="outline" className={`${conditionColor(listing.condition)} border-none text-xs shrink-0`}>
                         {listing.condition}
                       </Badge>
                       {listing.status === 'Available' && (
                         <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-none text-[10px] shrink-0">Active</Badge>
                       )}
                       {listing.status === 'Pending' && (
                         <Badge className="bg-amber-500 text-white border-none text-[10px] shrink-0 animate-pulse">⏳ In Progress</Badge>
                       )}
                       {listing.status === 'Sold' && (
                         <Badge className="bg-slate-500 text-white border-none text-[10px] shrink-0">Sold</Badge>
                       )}
                    </div>
                    <button
                      onClick={() => handleDelete(listing.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                      title="Delete Listing"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">{listing.category} • <span className="font-semibold text-slate-700 dark:text-zinc-200">₹{listing.price}</span></p>

                  {/* Interested Buyers */}
                  {listing.interests?.length > 0 ? (
                    <div className="mt-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                        <Users className="h-3.5 w-3.5" />
                        {listing.interests.length} interested buyer{listing.interests.length > 1 ? "s" : ""}
                      </div>
                      <div className="flex flex-col gap-2">
                        {listing.interests.map((interest) => (
                          <div key={interest.buyer_id} className="flex items-center justify-between bg-slate-50 dark:bg-zinc-950 p-2 rounded-lg border border-slate-100 dark:border-zinc-800 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-slate-700 dark:text-zinc-300 font-medium truncate">
                                {interest.profiles?.full_name || interest.profiles?.email}
                              </span>
                              {interest.status === 'Pending' && <Badge className="bg-amber-400 text-white border-none text-[9px] h-4 px-1">Wants it</Badge>}
                              {interest.status === 'Confirmed' && <Badge className="bg-emerald-500 text-white border-none text-[9px] h-4 px-1">Sold</Badge>}
                              {interest.status === 'Cancelled' && <Badge className="bg-slate-400 text-white border-none text-[9px] h-4 px-1">Cancelled</Badge>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {interest.status === 'Pending' && listing.status === 'Pending' && (
                                <>
                                  <button
                                    onClick={() => handleOrderAction(listing.id, interest.buyer_id, 'CONFIRM_SALE')}
                                    className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1.5 rounded-full hover:bg-emerald-200 transition-colors"
                                  >
                                    ✓ Confirm
                                  </button>
                                  <button
                                    onClick={() => handleOrderAction(listing.id, interest.buyer_id, 'REJECT_SALE')}
                                    className="text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2.5 py-1.5 rounded-full hover:bg-red-200 transition-colors"
                                  >
                                    ✕ Reject
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleStartChat(listing.id, interest.buyer_id)}
                                className="flex items-center gap-1.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2.5 py-1.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors"
                              >
                                <MessageCircle className="h-3 w-3" /> Chat
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400 dark:text-zinc-500">No buyers yet. Share this on WhatsApp to boost visibility!</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Acceptance Confirmation Dialog */}
      <Dialog open={!!confirmModal} onOpenChange={(open: boolean) => !open && setConfirmModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Accept Deal?
            </DialogTitle>
            <DialogDescription>
              Confirming this sale will mark the item as <strong>Sold</strong> and notify the buyer.
            </DialogDescription>
          </DialogHeader>
          {confirmModal && (
            <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-2 my-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-zinc-500">Item:</span>
                <span className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">{confirmModal.listingTitle}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-zinc-500">Buyer:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{confirmModal.buyerName}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-zinc-800">
                <span className="text-slate-500 dark:text-zinc-500 font-medium">Final Price:</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">₹{confirmModal.price}</span>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setConfirmModal(null)} className="rounded-full">
              Wait, Cancel
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold px-8 shadow-lg shadow-emerald-500/20"
              onClick={async () => {
                if (!confirmModal) return;
                setIsAccepting(true);
                await executeOrderAction(confirmModal.listingId, confirmModal.buyerId, 'CONFIRM_SALE');
                setIsAccepting(false);
                setConfirmModal(null);
              }}
              disabled={isAccepting}
            >
              {isAccepting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Accept Deal ✅"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
