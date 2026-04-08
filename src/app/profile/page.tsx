"use client";

import { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/shared/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Camera, Loader2, LogOut, Moon, Save, Sun, Receipt, ChevronRight } from "lucide-react";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [studentYear, setStudentYear] = useState("");
  const [branch, setBranch] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("profiles")
        .select("full_name, student_year, branch, avatar_url")
        .eq("id", user.id)
        .single();

      if (data) {
        setFullName(data.full_name ?? "");
        setStudentYear(data.student_year?.toString() ?? "");
        setBranch(data.branch ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      }
      setIsLoading(false);
    }
    loadProfile();
  }, []);

  async function handleSave() {
    if (!userId) return;
    setIsSaving(true);
    setSavedMsg("");

    const { error } = await supabase.from("profiles").update({
      full_name: fullName,
      student_year: studentYear ? parseInt(studentYear) : null,
      branch,
    }).eq("id", userId);

    if (error) {
      setSavedMsg("Error: " + error.message);
    } else {
      setSavedMsg("Profile saved successfully!");
      setTimeout(() => setSavedMsg(""), 3000);
    }
    setIsSaving(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setIsUploadingAvatar(true);

    const ext = file.name.split(".").pop();
    const fileName = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true });

    if (uploadError) { alert("Upload failed: " + uploadError.message); setIsUploadingAvatar(false); return; }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);
    const urlWithBust = `${publicUrl}?t=${Date.now()}`;

    await supabase.from("profiles").update({ avatar_url: urlWithBust }).eq("id", userId);
    setAvatarUrl(urlWithBust);
    setIsUploadingAvatar(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = fullName
    ? fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : email.slice(0, 2).toUpperCase();

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <Navbar />
      <div className="flex justify-center items-center py-32"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-lg">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-8">Profile & Settings</h1>

        {/* Avatar Upload */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 mb-4">
          <h2 className="font-semibold text-slate-700 dark:text-zinc-200 mb-4">Profile Photo</h2>
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20 ring-2 ring-blue-500/30">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback className="bg-blue-600 text-white font-bold text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 h-7 w-7 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
              >
                {isUploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-zinc-100">{fullName || "Your Name"}</p>
              <p className="text-sm text-slate-500 dark:text-zinc-400">{email}</p>
              <button onClick={() => fileInputRef.current?.click()} className="text-xs text-blue-600 dark:text-blue-400 mt-1 hover:underline">
                Change photo
              </button>
            </div>
          </div>
        </div>

        {/* Transactions Link */}
        <div 
          onClick={() => router.push('/transactions')}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 mb-4 flex items-center justify-between hover:border-blue-500/50 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-800/30">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-zinc-100 text-lg">Digital Transactions</h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400">View receipts for items bought and sold</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
        </div>

        {/* Profile Info */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 mb-4">
          <h2 className="font-semibold text-slate-700 dark:text-zinc-200 mb-4">Personal Information</h2>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Full Name</label>
                {!isEditingName && (
                  <button onClick={() => setIsEditingName(true)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    Edit Name
                  </button>
                )}
              </div>
              {isEditingName ? (
                <div className="flex gap-2">
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Hari Prasad" className="dark:bg-zinc-950" autoFocus />
                  <Button onClick={() => { setIsEditingName(false); handleSave(); }} size="icon" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="font-semibold text-slate-900 dark:text-white px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-md">
                  {fullName || "Not set"}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Email</label>
              <Input value={email} disabled className="mt-1 opacity-50 dark:bg-zinc-950" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Year</label>
                <select value={studentYear} onChange={(e) => setStudentYear(e.target.value)} className="w-full mt-1 p-2.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select...</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Branch</label>
                <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="e.g. CSE" className="mt-1 dark:bg-zinc-950" />
              </div>
            </div>
          </div>

          {savedMsg && (
            <p className={`mt-3 text-sm font-medium ${savedMsg.startsWith("Error") ? "text-red-500" : "text-emerald-600"}`}>
              {savedMsg}
            </p>
          )}

          <Button onClick={handleSave} disabled={isSaving} className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
          </Button>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 mb-4">
          <h2 className="font-semibold text-slate-700 dark:text-zinc-200 mb-4">Appearance</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDark ? <Moon className="h-5 w-5 text-blue-400" /> : <Sun className="h-5 w-5 text-amber-500" />}
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-100">{isDark ? "Dark Mode" : "Light Mode"}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Switch your display theme</p>
              </div>
            </div>
            <Switch checked={isDark} onCheckedChange={(val) => setTheme(val ? "dark" : "light")} />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-zinc-900 border border-red-100 dark:border-red-900/30 rounded-2xl p-6">
          <h2 className="font-semibold text-red-600 dark:text-red-400 mb-4">Account</h2>
          <Button onClick={handleLogout} variant="outline" className="w-full border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold">
            <LogOut className="mr-2 h-4 w-4" /> Log Out
          </Button>
        </div>
      </main>
    </div>
  );
}
