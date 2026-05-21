import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import Lottie from "lottie-react";
import LoaderAnimation from "@/components/ui/cbee_loding.json";
// import DarkLoaderAnimation from "@/components/ui/cbee_dark_loading.json";
import DarkLoaderAnimation from "@/components/ui/dark_loader.json";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage = () => {
  const { theme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromSignup = location.state?.fromSignup || false;

  const [showAnimation, setShowAnimation] = useState(fromSignup);
  const [showForm, setShowForm] = useState(!fromSignup);

  // animation timeout logic
  useEffect(() => {
    if (fromSignup) {
      const timeout = setTimeout(() => {
        setShowAnimation(false);
        setShowForm(true);
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [fromSignup]);

  // redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const isNative = Capacitor.isNativePlatform();
      const redirectUrl = isNative
        ? "app.cbee.online://callback"
        : `${window.location.origin}/`;

      // Phase 2 ADR-011: Lovable disconnected. Go direct to Supabase OAuth.
      // On native we ask Supabase to skip its own redirect, take the URL it
      // builds, and open it in the system browser (SFSafariViewController on
      // iOS / Chrome Custom Tabs on Android). The deep link comes back to
      // app.cbee.online://callback, where main.tsx's appUrlOpen listener
      // exchanges code/tokens for a session.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: isNative,
        },
      });

      if (error) {
        setIsGoogleLoading(false);
        toast({
          title: "Login failed",
          description: error.message ?? "Failed to initiate Google login",
          variant: "destructive",
          duration: 1500,
        });
        return;
      }

      if (isNative && data?.url) {
        await Browser.open({
          url: data.url,
          presentationStyle: "popover",
          windowName: "_self",
        });
        // appUrlOpen listener (src/main.tsx) handles the callback.
        return;
      }
      // Web: Supabase has already navigated us to Google's consent page.
    } catch (error) {
      setIsGoogleLoading(false);
      toast({
        title: "Login failed",
        description: "Failed to initiate Google login",
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const { data: loginData, error } = await supabase.auth.signInWithPassword(
        {
          email: data.email,
          password: data.password,
        }
      );

      if (error) {
        let errorMessage = error.message;

        if (error.message.includes("Invalid login credentials")) {
          errorMessage = "Invalid email or password.";
        } else if (error.message.includes("Email not confirmed")) {
          errorMessage = "Please confirm your email before logging in.";
        } else if (error.message.includes("Too many requests")) {
          errorMessage = "Too many attempts. Try again shortly.";
        } else if (error.message.includes("database")) {
          errorMessage = "Temporary issue. Try again.";
        }

        toast({
          title: "Login failed",
          description: errorMessage,
          variant: "destructive",
          duration: 1500,
        });
        return;
      }

      if (loginData?.user && loginData?.session) {
        toast({
          title: "Login successful!",
          description: "Welcome back to Cbee!",
          duration: 1500,
        });
        // AuthContext will handle redirection
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Unexpected error. Try again.",
        variant: "destructive",
        duration: 1500,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      // <div className="flex flex-col items-center justify-center min-h-screen">
      //   <Lottie
      //     animationData={LoaderAnimation}
      //     loop
      //     autoplay
      //     className="w-80 h-80"
      //   />
      // </div>
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Lottie
          animationData={
            theme === "dark" ? DarkLoaderAnimation : LoaderAnimation
          }
          loop
          autoplay
          className="w-80 h-80"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      {showAnimation && (
        <DotLottieReact
          src="https://lottie.host/d646ef2a-ad32-42b8-92ab-98b8179af0d1/x6La597nfI.lottie"
          autoplay
          loop={false}
          style={{ width: 200, height: 200 }}
        />
      )}

      {showForm && (
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <img
              src="/lovable-uploads/9019dcec-1bb4-4b6c-aa4d-8c082145555e.png"
              alt="Cbee Logo"
              className="w-28 h-28 mb-4 rounded-full object-cover"
            />
          </div>

          <div className="flex flex-col items-center mb-8">
            <h1 className="text-3xl font-medium text-foreground">
              Welcome Back!
            </h1>
            <p className="text-sm mt-2 text-muted-foreground">
              Login to continue to Cbee
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="you@example.com"
                        type="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                        >
                          {showPassword ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full rounded-xl bg-[#26A69A] text-white hover:bg-[#26A69A]/90"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full mt-4 rounded-xl border border-[1px] border-gray-300 hover:bg-[#26A69A]/70"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Opening Google...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>
          </div>

          <div className="text-center mt-6">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="font-medium text-[#26A69A] hover:text-[#26A69A]/80"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
