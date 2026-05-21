
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import StatusBarConfig from "@/components/StatusBarConfig";
import OfflineDetector from "@/components/OfflineDetector";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAndroidBackHandler } from "@/hooks/useAndroidBackHandler";
import { useNativePush } from "@/hooks/useNativePush";
import { useNativeKeyboard } from "@/hooks/useNativeKeyboard";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";

// Lazy-load non-critical routes for faster initial load
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const UploadPage = lazy(() => import("./pages/UploadPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ActivityPage = lazy(() => import("./pages/ActivityPage"));
const ReelsPage = lazy(() => import("./pages/ReelsPage"));
const PostDetailPage = lazy(() => import("./pages/PostDetailPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const SplashScreen = lazy(() => import("./pages/SplashScreen"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const FeedbackPage = lazy(() => import("./pages/FeedbackPage"));
const PaymentStatusPage = lazy(() => import("./pages/PaymentStatusPage"));

// Tuned for 10k–100k DAU: dedupe, cache, limit refetches
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min — serve cached instantly
      gcTime: 24 * 60 * 60 * 1000, // 24h — keep in memory + persisted store
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
    },
    mutations: {
      retry: 1,
    },
  },
});

// Persist React Query cache to localStorage so pages render instantly
// from cache on next visit / app cold-start.
if (typeof window !== "undefined") {
  try {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "cbee-query-cache",
      throttleTime: 1000,
    });
    persistQueryClient({
      queryClient: queryClient as any,
      persister,
      maxAge: 24 * 60 * 60 * 1000, // 24h
      // Bumped for Phase 2: `posts` rows gained media_kind/aspect/duration/
      // thumbnail/view_count. Old cached entries lack these fields and would
      // render incorrectly. Bump again on any breaking schema/shape change.
      buster: "v2",
    });
  } catch (e) {
    console.warn("Query cache persistence unavailable", e);
  }
}

const AppWithBackHandler = () => {
  useAndroidBackHandler();
  // Native push (iOS APNs / Android FCM); web is a no-op here
  useNativePush();
  // Track native keyboard so .pb-keyboard works
  useNativeKeyboard();
  
  return (
    <Suspense fallback={null}>
    <Routes>
      {/* Public Routes */}
      <Route path="/splash" element={<SplashScreen />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/feedback" element={<FeedbackPage />} />
      <Route path="/payment-status" element={<PaymentStatusPage />} />
      
      {/* Protected App Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route index element={<HomePage />} />
        <Route path="profile/:userId" element={<ProfilePage />} />
        <Route path="user/:userId" element={<UserProfilePage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="reels" element={<ReelsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:userId" element={<MessagesPage />} />
        <Route path="post/:postId" element={<PostDetailPage />} />
      </Route>

      {/* Redirect to splash screen by default */}
      <Route path="/index" element={<Navigate to="/splash" replace />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="cbee-ui-theme">
      <StatusBarConfig />
      <OfflineDetector>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppWithBackHandler />
            </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
      </OfflineDetector>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
