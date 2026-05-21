import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import Lottie from "lottie-react";
import LoaderAnimation from "@/components/ui/cbee_loding.json";
import DarkLoaderAnimation from "@/components/ui/dark_loader.json";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PrivacyPolicyDialog from "@/components/PrivacyPolicyDialog";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { theme } = useTheme();
  const { user, loading } = useAuth();
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [checkingPolicy, setCheckingPolicy] = useState(true);

  useEffect(() => {
    const checkPrivacyPolicyAcceptance = async () => {
      if (user) {
        try {
          // Use maybeSingle() for Safari compatibility - avoids errors when no rows exist
          const { data, error } = await supabase
            .from("profiles")
            .select("privacy_policy_accepted")
            .eq("id", user.id)
            .maybeSingle();

          // Only throw on actual errors, not "no rows" which is handled by maybeSingle
          if (error) {
            console.error("Error checking privacy policy:", error);
            // Don't block the user on error - allow access
            setCheckingPolicy(false);
            return;
          }

          // If no profile or policy not accepted, show dialog
          if (!data || !data.privacy_policy_accepted) {
            setShowPrivacyPolicy(true);
          }
        } catch (err) {
          console.error("Error checking privacy policy:", err);
          // Don't block on errors - allow access
        }
      }
      setCheckingPolicy(false);
    };

    if (!loading && user) {
      checkPrivacyPolicyAcceptance();
    } else if (!loading) {
      setCheckingPolicy(false);
    }
  }, [user, loading]);

  if (loading || checkingPolicy) {
    return (
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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (showPrivacyPolicy) {
    return (
      <PrivacyPolicyDialog
        isOpen={showPrivacyPolicy}
        onAccept={() => setShowPrivacyPolicy(false)}
        userId={user.id}
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
