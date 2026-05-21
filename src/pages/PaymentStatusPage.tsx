import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

const PaymentStatusPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [order, setOrder] = useState<any>(null);
  const orderId = searchParams.get("orderId");

  useEffect(() => {
    if (!orderId) {
      setStatus("failed");
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('payment-status', {
          body: { orderId }
        });

        if (error) {
          throw error;
        }

        if (data?.success) {
          setOrder(data.order);
          setStatus(data.status === "SUCCESS" ? "success" : "failed");
        } else {
          setStatus("failed");
        }
      } catch (error) {
        console.error("Error checking payment status:", error);
        setStatus("failed");
        toast("Failed to check payment status");
      }
    };

    checkPaymentStatus();
  }, [orderId]);

  const handleBackToHome = () => {
    navigate("/");
  };

  const handleBackToSupport = () => {
    navigate("/support");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen">
        <AppHeader title="Payment Status" showBackButton />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
            <h2 className="text-xl font-semibold">Checking Payment Status...</h2>
            <p className="text-muted-foreground">Please wait while we verify your payment</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <AppHeader title="Payment Status" showBackButton />
      <div className="p-4 max-w-md mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 justify-center">
              {status === "success" ? (
                <>
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  Payment Successful
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 text-red-500" />
                  Payment Failed
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === "success" ? (
              <div className="text-center space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-green-700 dark:text-green-300 font-medium">
                    Thank you for your generous donation!
                  </p>
                  <p className="text-green-600 dark:text-green-400 text-sm mt-1">
                    Your contribution helps us continue building amazing features for pet lovers.
                  </p>
                </div>
                
                {order && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Donor:</span>
                      <span className="font-medium">{order.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-medium">₹{(order.amount / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction ID:</span>
                      <span className="font-medium text-xs">{order.phonepe_transaction_id}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-red-700 dark:text-red-300 font-medium">
                    Payment could not be completed
                  </p>
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                    Don't worry, no amount has been deducted from your account.
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleBackToHome}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Home
              </Button>
              {status === "failed" && (
                <Button
                  onClick={handleBackToSupport}
                  className="flex-1 bg-[#26A69A] text-white hover:bg-[#26A69A]/90"
                >
                  Try Again
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentStatusPage;