import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  useUsernameCheck,
  generateUsernameSuggestions,
} from "@/hooks/useUsernameCheck";

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

const signupSchema = z
  .object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z
      .string()
      .min(8, "Password must be at least 8 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

const SignupPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const navigate = useNavigate();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const watchedUsername = form.watch("username");
  const watchedFullName = form.watch("fullName");
  const { data: usernameCheckResult } = useUsernameCheck(watchedUsername);

  useEffect(() => {
    if (
      usernameCheckResult &&
      !usernameCheckResult.available &&
      watchedFullName
    ) {
      const suggestions = generateUsernameSuggestions(
        watchedFullName,
        watchedUsername
      );
      setUsernameSuggestions(suggestions);
    } else {
      setUsernameSuggestions([]);
    }
  }, [usernameCheckResult, watchedFullName, watchedUsername]);

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);

    try {
      // emailRedirectTo only matters when email confirmation is enabled.
      // The DB trigger `auto_confirm_new_user_trigger` auto-confirms every
      // new auth.users row, so this redirect is effectively unused — kept
      // in case the client re-enables email confirmation later with real SMTP.
      const redirectUrl = 'app.cbee.online://callback';

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: data.username,
            full_name: data.fullName,
          },
        },
      });

      if (error) {
        console.error("Signup error occurred");

        let errorMessage = error.message;

        // Handle specific error cases
        if (error.message.includes("User already registered")) {
          errorMessage =
            "An account with this email already exists. Please try logging in instead.";
        } else if (error.message.includes("Invalid email")) {
          errorMessage = "Please enter a valid email address.";
        } else if (error.message.includes("Password")) {
          errorMessage = "Password must be at least 6 characters long.";
        } else if (error.message.includes("database")) {
          errorMessage =
            "There was a temporary issue creating your account. Please try again.";
        }

        toast({
          title: "Signup failed",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      if (!signUpData?.user) {
        return;
      }

      // With the auto-confirm trigger active, the signUp call may still
      // return a `user` without a `session` (Supabase only creates a session
      // when it confirms inline). Fall back to a password sign-in so the
      // user lands logged-in either way.
      if (!signUpData.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (signInError) {
          console.error("Auto sign-in after signup failed:", signInError);
          toast({
            title: "Account created!",
            description:
              "Sign-up worked but auto-login didn't. Please log in with your new credentials.",
          });
          navigate("/login", { state: { fromSignup: true } });
          return;
        }
      }

      toast({
        title: "Welcome to Cbee!",
        description: "Your account is ready.",
      });
      // AuthContext picks up the new session and ProtectedRoute will let
      // us into '/'. navigate() drops the signup URL from history.
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Unexpected signup error occurred");
      toast({
        title: "Signup failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-surface-main p-4 pt-4">
      <div className="w-full max-w-md space-y-3 bg-surface-card p-5 rounded-2xl">
        <div className="flex flex-col items-center mb-2">
          <img
            src="/lovable-uploads/9019dcec-1bb4-4b6c-aa4d-8c082145555e.png"
            alt="Cbee Logo"
            className="w-16 h-16 mb-2 rounded-full object-cover"
          />
        </div>
        <div className="text-center mb-3">
          <h1 className="text-xl font-medium text-foreground">
            Create Account
          </h1>
          <p className="text-xs mt-1 text-text-secondary">
            Join Cbee meet Hearts
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2.5">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Your full name"
                      {...field}
                      className="h-9"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Username</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="Your username"
                        {...field}
                        className="h-9 pr-8"
                      />
                      {watchedUsername.length >= 3 && usernameCheckResult && (
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                          {usernameCheckResult.available ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  {!usernameCheckResult?.available &&
                    usernameSuggestions.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-red-500 mb-1">
                          Username already exists. Try these:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {usernameSuggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() =>
                                form.setValue("username", suggestion)
                              }
                              className="px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="you@example.com"
                      type="email"
                      {...field}
                      className="h-9"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => {
                const password = field.value || "";

                const hasUpperCase = /[A-Z]/.test(password);
                const hasLowerCase = /[a-z]/.test(password);
                const hasNumber = /[0-9]/.test(password);
                const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

                const isStrong =
                  hasUpperCase && hasLowerCase && hasNumber && hasSymbol;

                return (
                  <FormItem>
                    <FormLabel className="text-sm">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          className="pr-10 h-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-[#26A69A] transition-colors"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <div className="text-xs mt-1 flex flex-wrap gap-1">
                      <span
                        className={
                          isStrong ? "text-[#26A69A]" : "text-[#CC3333]"
                        }
                      >
                        Include:
                      </span>
                      <span
                        className={
                          hasUpperCase ? "text-[#26A69A]" : "text-[#CC3333]"
                        }
                      >
                        • A-Z
                      </span>
                      <span
                        className={
                          hasLowerCase ? "text-[#26A69A]" : "text-[#CC3333]"
                        }
                      >
                        • a-z
                      </span>
                      <span
                        className={
                          hasNumber ? "text-[#26A69A]" : "text-[#CC3333]"
                        }
                      >
                        • 0-9
                      </span>
                      <span
                        className={
                          hasSymbol ? "text-[#26A69A]" : "text-[#CC3333]"
                        }
                      >
                        • Symbol
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...field}
                        className="h-9"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-[#26A69A] transition-colors"
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
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
              className="w-full mt-3 bg-[#26A69A] text-white hover:bg-[#26A69A]/90 h-9"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader className="mr-2 h-3 w-3 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Sign Up"
              )}
            </Button>
          </form>
        </Form>

        <div className="text-center mt-3">
          <p className="text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-[#26A69A] hover:text-[#26A69A]/80"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
