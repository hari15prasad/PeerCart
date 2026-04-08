"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/shared/navbar";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ReceiptText, Calendar, Wallet, Download, Search, CheckCircle2, User as UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";

type Transaction = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  final_price: number;
  created_at: string;
  listings: { title: string; category: string; image_url: string };
  buyer: { full_name: string; email: string };
  seller: { full_name: string; email: string };
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filtered, setFiltered] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<"ALL" | "BOUGHT" | "SOLD">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  
  const [receiptModal, setReceiptModal] = useState<Transaction | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);

      const { data, error } = await supabase
        .from("transactions")
        .select(`
          id, listing_id, buyer_id, seller_id, final_price, created_at,
          listings (title, category, image_url),
          buyer:profiles!buyer_id (full_name, email),
          seller:profiles!seller_id (full_name, email)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (data) {
        setTransactions(data as unknown as Transaction[]);
        setFiltered(data as unknown as Transaction[]);
      }
      setIsLoading(false);
    }
    load();
  }, [router, supabase]);

  useEffect(() => {
    if (!userId) return;
    let result = transactions;

    if (filterType === "BOUGHT") {
      result = result.filter((t) => t.buyer_id === userId);
    } else if (filterType === "SOLD") {
      result = result.filter((t) => t.seller_id === userId);
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.listings?.title.toLowerCase().includes(q) ||
          t.buyer?.full_name?.toLowerCase().includes(q) ||
          t.seller?.full_name?.toLowerCase().includes(q)
      );
    }

    setFiltered(result);
  }, [filterType, searchQuery, transactions, userId]);

  const downloadReceipt = () => {
    window.print(); // Simple way to save receipt as PDF
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <ReceiptText className="h-8 w-8 text-blue-600" />
              Digital Transactions
            </h1>
            <p className="mt-1 text-slate-600 dark:text-zinc-400">Your complete history of items bought and sold.</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
            <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg w-full sm:w-auto">
              {(["ALL", "BOUGHT", "SOLD"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                    filterType === type
                      ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {type === "ALL" ? "All History" : type === "BOUGHT" ? "Purchased" : "Sold"}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search items or people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 dark:bg-zinc-950"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24 text-slate-400 dark:text-zinc-500">
              <ReceiptText className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-medium">No transactions found.</p>
              <p className="text-sm mt-1">When you buy or sell items, they will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((tx) => {
                const isBuyer = tx.buyer_id === userId;
                return (
                  <div key={tx.id} className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/50 hover:border-blue-200 dark:hover:border-blue-900/50 transition-colors gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className="h-12 w-12 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-zinc-700">
                        <Wallet className={`h-6 w-6 ${isBuyer ? "text-emerald-500" : "text-blue-500"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={isBuyer ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"}>
                            {isBuyer ? "Bought" : "Sold"}
                          </Badge>
                          <span className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(tx.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1">{tx.listings?.title || "Unknown Item"}</h3>
                        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          {isBuyer ? `From: ${tx.seller?.full_name || "Seller"}` : `To: ${tx.buyer?.full_name || "Buyer"}`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 sm:gap-6 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-slate-100 sm:border-0 dark:border-zinc-800">
                      <div className={`font-black text-lg ${isBuyer ? "text-red-500" : "text-emerald-600"}`}>
                        {isBuyer ? "-" : "+"}₹{tx.final_price}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setReceiptModal(tx)}>
                        View Receipt
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Receipt Modal */}
      <Dialog open={!!receiptModal} onOpenChange={(open: boolean) => !open && setReceiptModal(null)}>
        <DialogContent className="sm:max-w-md print:shadow-none print:border-none print:w-full print:max-w-none">
          {receiptModal && (
            <>
              <div className="print:block" id="receipt-content">
                <div className="text-center mb-6">
                  <div className="mx-auto h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">Transaction Receipt</h2>
                  <p className="text-sm text-slate-500">PeerCart Digital Marketplace</p>
                </div>

                <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl p-5 border border-slate-100 dark:border-zinc-800 space-y-4">
                  <div className="flex justify-between items-end border-b border-slate-200 dark:border-zinc-800 pb-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Final Amount</p>
                      <p className="text-3xl font-black text-slate-900 dark:text-white">₹{receiptModal.final_price}</p>
                    </div>
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none mb-1">Completed</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                    <div>
                      <p className="text-slate-500 dark:text-zinc-400 mb-0.5">Item Name</p>
                      <p className="font-semibold text-slate-900 dark:text-white line-clamp-2">{receiptModal.listings?.title}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-zinc-400 mb-0.5">Date & Time</p>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {new Date(receiptModal.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-zinc-400 mb-0.5">Seller</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{receiptModal.seller?.full_name || 'Seller'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-zinc-400 mb-0.5">Buyer</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{receiptModal.buyer?.full_name || 'Buyer'}</p>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-200 dark:border-zinc-800">
                    <p className="text-[10px] text-center text-slate-400">Transaction ID: {receiptModal.id}</p>
                  </div>
                </div>
              </div>
              
              <DialogFooter className="sm:justify-between mt-6 print:hidden">
                <Button variant="outline" onClick={() => setReceiptModal(null)}>Close</Button>
                <Button onClick={downloadReceipt} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Download className="h-4 w-4 mr-2" /> Download Receipt
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
