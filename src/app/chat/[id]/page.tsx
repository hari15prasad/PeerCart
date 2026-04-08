"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/shared/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Image as ImageIcon, Mic, MicOff, Loader2, Play, Pause, Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type Message = {
  id: string;
  sender_id: string;
  content: string | null;
  file_url: string | null;
  file_type: string | null;
  created_at: string;
};

type Participant = { id: string; email: string; full_name: string | null; trust_score?: number };

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<Participant | null>(null);
  const [listingId, setListingId] = useState<string>("");
  const [listingTitle, setListingTitle] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Order Lifecycle State
  const [interestStatus, setInterestStatus] = useState<string | null>(null);
  const [isBuyer, setIsBuyer] = useState(false);
  const [isManagingOrder, setIsManagingOrder] = useState(false);

  // Rating Modal State
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load conversation + messages
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      // Load conversation details
      const { data: conv } = await supabase
        .from("conversations")
        .select("*, listings(id, title), buyer:buyer_id(id,email,full_name,trust_score), seller:seller_id(id,email,full_name,trust_score)")
        .eq("id", id)
        .single();

      if (conv) {
        setListingId((conv.listings as any)?.id ?? "");
        setListingTitle((conv.listings as any)?.title ?? "Listing");
        
        const amIBuyer = user.id === conv.buyer_id;
        setIsBuyer(amIBuyer);

        const other = amIBuyer
          ? conv.seller as unknown as Participant
          : conv.buyer as unknown as Participant;
        setOtherUser(other);

        // Fetch strict order status
        if ((conv.listings as any)?.id) {
          const { data: interest } = await supabase
            .from("interests")
            .select("status")
            .eq("listing_id", (conv.listings as any).id)
            .eq("buyer_id", conv.buyer_id)
            .single();
          if (interest) setInterestStatus(interest.status);
        }
      }

      // Load existing messages
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      if (msgs) setMessages(msgs);
    }
    init();
  }, [id]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, supabase]);

  async function handleOrderAction(actionType: string) {
    if (!listingId || !otherUser || !userId) return;
    setIsManagingOrder(true);
    const buyerId = isBuyer ? userId : otherUser.id;
    const { data: success, error } = await supabase.rpc("manage_order_lifecycle", {
      target_listing_id: listingId,
      target_buyer_id: buyerId,
      action_type: actionType
    });
    
    if (success) {
       if (actionType === 'CONFIRM_SALE') setInterestStatus("Confirmed");
       if (actionType === 'CANCEL_PURCHASE' || actionType === 'REJECT_SALE') setInterestStatus("Cancelled");
    } else {
       alert("Order action failed. " + (error?.message || ""));
    }
    setIsManagingOrder(false);
  }

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(content?: string, fileUrl?: string, fileType?: string) {
    if (!userId) return;
    setIsSending(true);
    await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: userId,
      content: content || null,
      file_url: fileUrl || null,
      file_type: fileType || null,
    });
    setText("");
    setIsSending(false);
  }

  async function handleSendText(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await sendMessage(text.trim());
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-files").upload(path, file);
    if (error) { alert("Upload failed: " + error.message); return; }
    const { data: { publicUrl } } = supabase.storage.from("chat-files").getPublicUrl(path);
    await sendMessage(undefined, publicUrl, "image");
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const path = `${userId}/audio-${Date.now()}.webm`;
        await supabase.storage.from("chat-files").upload(path, blob);
        const { data: { publicUrl } } = supabase.storage.from("chat-files").getPublicUrl(path);
        await sendMessage(undefined, publicUrl, "audio");
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    }
  }

  async function submitReview() {
    if (rating < 1 || rating > 5) {
      alert("Please select a star rating.");
      return;
    }
    if (!otherUser || !userId || !listingId) return;

    setIsSubmittingReview(true);
    const { error } = await supabase.from("reviews").insert({
      listing_id: listingId,
      reviewer_id: userId,
      reviewee_id: otherUser.id,
      rating,
      comment: reviewComment.trim()
    });

    if (error) {
      if (error.message.includes("duplicate")) {
        alert("You have already reviewed this user for this transaction.");
      } else {
        alert("Error submitting review: " + error.message);
      }
    } else {
      alert("Review submitted successfully! Their trust score has been updated.");
      setIsRatingOpen(false);
      setRating(0);
      setReviewComment("");
      
      // Re-fetch conversation to strictly grab the new trust_score dictated by the SQL trigger
      const { data: updatedConv } = await supabase
        .from("conversations")
        .select("buyer:buyer_id(id,email,full_name,trust_score), seller:seller_id(id,email,full_name,trust_score)")
        .eq("id", id)
        .single();
        
      if (updatedConv) {
        const updatedOther = userId === (updatedConv.buyer as any).id
          ? updatedConv.seller as unknown as Participant
          : updatedConv.buyer as unknown as Participant;
        setOtherUser(updatedOther);
      }
    }
    setIsSubmittingReview(false);
  }

  const initials = (u: Participant) =>
    u.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) ?? u.email.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col">
      <Navbar />

      {/* Chat Header */}
      <div className="sticky top-16 z-40 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/chats")} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 flex-shrink-0">
          <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
        </button>
        {otherUser && (
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarFallback className="bg-blue-600 text-white font-bold text-xs">
              {initials(otherUser)}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
              {otherUser?.full_name || otherUser?.email}
            </p>
            {otherUser?.trust_score !== undefined && otherUser.trust_score > 0 && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0">
                <Star className="h-2.5 w-2.5 fill-current" /> {otherUser.trust_score}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate max-w-[150px] sm:max-w-xs">re: {listingTitle}</p>
            {interestStatus === 'Pending' && <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none text-[8px] h-3 px-1 leading-none">IN PROGRESS</Badge>}
            {interestStatus === 'Confirmed' && <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none text-[8px] h-3 px-1 leading-none">SOLD</Badge>}
            {interestStatus === 'Cancelled' && <Badge className="bg-slate-500 hover:bg-slate-600 text-white border-none text-[8px] h-3 px-1 leading-none">CANCELLED</Badge>}
          </div>
        </div>
        <div className="ml-auto pl-2 flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {interestStatus === 'Pending' && isBuyer && (
             <Button variant="outline" size="sm" onClick={() => handleOrderAction('CANCEL_PURCHASE')} disabled={isManagingOrder} className="text-[10px] h-7 px-2 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">Cancel</Button>
          )}
          {interestStatus === 'Pending' && !isBuyer && (
             <>
               <Button variant="outline" size="sm" onClick={() => handleOrderAction('CONFIRM_SALE')} disabled={isManagingOrder} className="text-[10px] h-7 px-2 border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">Confirm</Button>
               <Button variant="outline" size="sm" onClick={() => handleOrderAction('REJECT_SALE')} disabled={isManagingOrder} className="text-[10px] h-7 px-2 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">Reject</Button>
             </>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="text-[10px] sm:text-xs h-7 px-2 rounded-xl gap-1.5 border-slate-200 dark:border-zinc-700"
            onClick={() => setIsRatingOpen(true)}
          >
            <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> <span className="hidden sm:inline">Rate</span>
          </Button>
        </div>
      </div>

      {/* RATING MODAL */}
      {isRatingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-black mb-1">Rate Transaction</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-5">
              How was your experience with {otherUser?.full_name || "them"}?
            </p>

            <div className="flex items-center justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(s)}
                  className="p-1 transition-transform hover:scale-110 active:scale-95 outline-none"
                >
                  <Star 
                    className={`h-9 w-9 transition-colors ${
                      (hoverRating || rating) >= s 
                        ? "fill-amber-400 text-amber-400" 
                        : "text-slate-200 dark:text-zinc-800"
                    }`} 
                  />
                </button>
              ))}
            </div>

            <textarea
              className="w-full h-24 p-3 text-sm rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:border-blue-500 mb-4 resize-none placeholder:text-slate-400"
              placeholder="Leave a comment (optional)..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
            />

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 rounded-xl"
                onClick={() => { setIsRatingOpen(false); setRating(0); setHoverRating(0); setReviewComment(""); }}
              >
                Cancel
              </Button>
              <Button 
                onClick={submitReview} 
                disabled={isSubmittingReview || rating === 0} 
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700"
              >
                {isSubmittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl w-full mx-auto">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 dark:text-zinc-500 py-12 text-sm">
            Start the conversation! Ask about the item, arrange a meetup, etc.
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === userId;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                isMine
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 rounded-bl-sm border border-slate-100 dark:border-zinc-700"
              }`}>
                {msg.content && <p className="text-sm break-words">{msg.content}</p>}
                {msg.file_type === "image" && msg.file_url && (
                  <img src={msg.file_url} alt="shared image" className="max-w-full rounded-xl mt-1 max-h-60 object-cover" />
                )}
                {msg.file_type === "audio" && msg.file_url && (
                  <audio controls src={msg.file_url} className="mt-1 max-w-full h-8" />
                )}
                <p className={`text-[10px] mt-1 ${isMine ? "text-blue-200" : "text-slate-400 dark:text-zinc-500"}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 px-4 py-3">
        <form onSubmit={handleSendText} className="flex items-center gap-2 max-w-2xl mx-auto">
          {/* Image Upload */}
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 flex-shrink-0">
            <ImageIcon className="h-5 w-5" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

          {/* Audio Record */}
          <button type="button" onClick={toggleRecording}
            className={`p-2 rounded-full flex-shrink-0 transition-colors ${isRecording ? "bg-red-500 text-white animate-pulse" : "hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400"}`}>
            {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isRecording ? "Recording... tap mic to stop" : "Type a message..."}
            disabled={isRecording}
            className="flex-1 rounded-full bg-slate-100 dark:bg-zinc-800 border-none focus-visible:ring-1"
          />

          <Button type="submit" disabled={!text.trim() || isSending}
            className="p-2 h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 flex-shrink-0">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
