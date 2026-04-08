"use client";

import { useState } from "react";
import { Sparkles, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function ListingAssistant({ onPublished }: { onPublished?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [demandCount, setDemandCount] = useState<number>(0);

  const supabase = createClient();

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        // Intelligence: Probe for outstanding demands immediately!
        const { data: demandData } = await supabase.rpc("get_demand_count", {
          item_category: data.category,
          item_title: data.title
        });
        setDemandCount(demandData as number || 0);
      } else {
        alert("API Error: " + data.error);
      }
    } catch (err: any) {
      alert("Network Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!result?.imageFile) return;
    setIsPublishing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert("You must be logged in to publish."); return; }

      // 1. Upload image to Supabase Storage
      const fileExt = result.imageFile.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("listings")
        .upload(fileName, result.imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("listings")
        .getPublicUrl(fileName);

      // 2. Insert listing into DB
      const { error: insertError } = await supabase.from("listings").insert({
        seller_id: user.id,
        title: result.title,
        description: result.description || null,
        category: result.category,
        price: result.price,
        condition: result.condition,
        image_url: publicUrl,
        metadata: result.metadata,
      });

      if (insertError) throw insertError;

      // 3. Close modal & refresh feed
      setIsOpen(false);
      setText("");
      setResult(null);
      onPublished?.();
    } catch (err: any) {
      alert("Publish failed: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full shadow-xl bg-blue-600 hover:bg-blue-700 text-white transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950/50">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" />
                <h2 className="font-semibold text-slate-800 dark:text-zinc-100">Smart Listing</h2>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {!result ? (
                <form onSubmit={handleExtract} className="space-y-4">
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Describe what you're selling. AI will structure it for you in seconds.
                  </p>
                  <Input
                    placeholder="e.g., Selling my 3rd sem DBMS book by Navathe, good condition, ₹400"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="h-12 bg-slate-50 dark:bg-zinc-950"
                    autoFocus
                  />
                  <Button type="submit" className="w-full h-10 font-bold bg-slate-900 dark:bg-zinc-100 dark:text-zinc-900" disabled={isLoading || !text.trim()}>
                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Generate Listing"}
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 p-3 rounded-lg text-sm border border-emerald-100 dark:border-emerald-900/50 flex items-center">
                    <Sparkles className="h-4 w-4 mr-2" /> Extracted! Review and edit below.
                  </div>

                  {demandCount > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 p-3 rounded-lg text-sm border border-blue-200 dark:border-blue-900/60 flex items-center font-bold animate-pulse">
                      🔥 {demandCount} student{demandCount > 1 ? 's are' : ' is'} currently looking for this based on recent searches!
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Item Name</span>
                      <Input value={result.title} onChange={(e) => setResult({ ...result, title: e.target.value })} className="h-9 mt-1 bg-slate-50 dark:bg-zinc-950" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Price (₹)</span>
                      <Input type="number" value={result.price} onChange={(e) => setResult({ ...result, price: Number(e.target.value) })} className="h-9 mt-1 bg-slate-50 dark:bg-zinc-950" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Category</span>
                      <select value={result.category} onChange={(e) => setResult({ ...result, category: e.target.value })} className="w-full mt-1 p-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md text-sm focus:outline-none">
                        <option>Books</option><option>Lab Coat</option><option>Electronics</option><option>Stationery</option><option>Other</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Condition</span>
                      <select value={result.condition} onChange={(e) => setResult({ ...result, condition: e.target.value })} className="w-full mt-1 p-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md text-sm focus:outline-none">
                        <option>New</option><option>Good</option><option>Fair</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Additional Comments</span>
                    <textarea placeholder="Any extra details..." value={result.description || ""} onChange={(e) => setResult({ ...result, description: e.target.value })} className="w-full mt-1 p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md text-sm min-h-[70px] focus:outline-none" />
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Item Photo <span className="text-red-500">*</span></span>
                    <Input type="file" accept="image/*" required onChange={(e) => { const file = e.target.files?.[0]; if (file) setResult({ ...result, imageFile: file }); }} className="mt-1 h-10 cursor-pointer bg-slate-50 dark:bg-zinc-950 file:mr-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-zinc-800 dark:file:text-zinc-300" />
                    {result.imageFile && <p className="mt-1 text-xs text-emerald-600 font-medium">✓ {result.imageFile.name}</p>}
                  </div>

                  <Button onClick={handlePublish} disabled={!result.imageFile || isPublishing} className="w-full h-12 mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20">
                    {isPublishing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing...</> : !result.imageFile ? "Attach a photo to publish" : "Publish to Feed"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
