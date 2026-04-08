"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GraduationCap, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Step = "login" | "signup" | "verify-otp";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  function resetForm() {
    setError("");
    setOtp("");
    setPassword("");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!email.trim().toLowerCase().endsWith(".edu")) {
      setError("Only valid campus .edu emails are allowed.");
      setIsLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
    } else {
      window.location.href = "/";
    }

    setIsLoading(false);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!email.trim().toLowerCase().endsWith(".edu")) {
      setError("Only valid campus .edu emails are allowed.");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setIsLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: undefined },
    });

    if (signUpError) {
      setError(signUpError.message);
    } else {
      // OTP emailed — move to verify step
      setStep("verify-otp");
    }

    setIsLoading(false);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: "signup",
    });

    if (verifyError) {
      setError(verifyError.message);
    } else {
      window.location.href = "/";
    }

    setIsLoading(false);
  }

  // --- Render: OTP Verification Step ---
  if (step === "verify-otp") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
        <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white dark:bg-zinc-900 p-8 shadow-xl border border-slate-100 dark:border-zinc-800">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-3 mb-2">
              <MailCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Check your inbox</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-2">
              We emailed a 6-digit OTP to <span className="font-semibold text-slate-700 dark:text-zinc-200">{email}</span>. Enter it below to activate your account.
            </p>
            <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 text-xs p-2 rounded border border-amber-200 dark:border-amber-800 text-center">
              Haven't received it? Check your <strong>Spam folder</strong>. (Note: Supabase free tier limits emails to 3 per hour).
            </div>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit OTP"
              required
              autoFocus
              className="h-14 text-center text-2xl tracking-[0.5em] font-bold border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950"
            />

            {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

            <Button type="submit" disabled={isLoading || otp.length < 6} className="h-12 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</> : "Verify & Continue"}
            </Button>
          </form>

          <div className="text-center">
            <button onClick={() => { setStep("signup"); resetForm(); }} className="text-sm text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 font-medium">
              ← Back to Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  }

  // --- Render: Login / Signup Step ---
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white dark:bg-zinc-900 p-8 shadow-xl border border-slate-100 dark:border-zinc-800">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-3 mb-2">
            <GraduationCap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">PeerCart</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {step === "login" ? "Welcome back, student." : "Create your campus account."}
          </p>
        </div>

        {/* Google OAuth Button */}
        <Button
          type="button"
          onClick={handleGoogleLogin}
          variant="outline"
          className="h-12 w-full font-semibold border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-3"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </Button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200 dark:border-zinc-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-zinc-900 px-2 text-slate-400 dark:text-zinc-500">or continue with email</span>
          </div>
        </div>

        <form onSubmit={step === "login" ? handleLogin : handleSignUp} className="space-y-4">
          <div className="space-y-3">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@college.edu"
              required
              className="h-12 border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              required
              className="h-12 border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950"
            />
          </div>

          {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

          <Button type="submit" disabled={isLoading} className="h-12 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            {isLoading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {step === "login" ? "Logging in..." : "Sending OTP..."}</>
              : step === "login" ? "Login" : "Create Account"}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => { setStep(step === "login" ? "signup" : "login"); resetForm(); }}
            className="text-sm text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
          >
            {step === "login" ? "Need an account? Sign up" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
}

