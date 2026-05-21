import { useEffect, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import AppNavBar from "@/components/AppNavbar";
import Layout from "@/components/Layout";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Heart, CreditCard, Gift } from "lucide-react";

const RAZORPAY_BUTTON_ID = "pl_RhImfrFre1OcIL"; // your provided id

const SupportPage = () => {
  const [message, setMessage] = useState("");
  const formContainerRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const createdRef = useRef(false);

  // Create the form & Razorpay script only once on mount
  useEffect(() => {
    const container = formContainerRef.current;
    if (!container || createdRef.current) return;

    // create form
    const form = document.createElement("form");

    // hidden message input
    const messageInput = document.createElement("input");
    messageInput.type = "hidden";
    messageInput.name = "notes[message]";
    messageInput.value = message || "No message provided";
    form.appendChild(messageInput);
    messageInputRef.current = messageInput;

    // razorpay script (will render the payment button)
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/payment-button.js";
    script.setAttribute("data-payment_button_id", RAZORPAY_BUTTON_ID);
    script.async = true;

    form.appendChild(script);
    container.appendChild(form);

    createdRef.current = true;

    return () => {
      // cleanup
      container.innerHTML = "";
      createdRef.current = false;
      messageInputRef.current = null;
    };
    // empty deps so runs once
  }, []);

  // Update only the hidden input's value when message changes.
  // This avoids re-inserting the script and prevents layout shift.
  useEffect(() => {
    if (messageInputRef.current) {
      messageInputRef.current.value = message || "No message provided";
    }
  }, [message]);

  return (
    <>
      <AppHeader title="Support Us" showBackButton />
      <AppNavBar />
      <Layout>
        <div className="p-4 max-w-md mx-auto space-y-6">
          <div className="text-center space-y-4">
            <div
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#e4f6ffff" }}
            >
              <Heart className="w-10 h-10 text-primary" fill="currentColor" />
            </div>

            <h1 className="text-2xl font-bold">Support Us</h1>
            <p className="text-muted-foreground">
              Help us continue building features for pet lovers worldwide.
            </p>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  One-time Support
                </CardTitle>
                <CardDescription className="space-y-1">
                  <p>• 💖 Make a one-time contribution to support pets.</p>
                  <p>
                    • 💡 Share your ideas and suggestions on our feedback page.
                  </p>
                  <p>
                    • 🔧 We constantly improve the platform with your inputs.
                  </p>
                  <p>• 🙏 Thank you for your valuable support!</p>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* <div className="space-y-2">
                  <Label>Your Support Message</Label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your message here..."
                    rows={5}
                    className="w-full min-h-[120px] resize-vertical bg-background border-input p-3 rounded-md focus:outline-none"
                  />
                </div> */}

                {/* Container where the Razorpay payment form + script will be injected */}
                <div ref={formContainerRef} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Other Ways to Help
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  • Share the app with pet lovers
                </p>
                <p className="text-sm text-muted-foreground">
                  • Leave a review on app stores
                </p>
                <p className="text-sm text-muted-foreground">
                  • Follow us on social media
                </p>
                <p className="text-sm text-muted-foreground">
                  • Provide feedback and suggestions
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Thank you for being part of our community! 🐾
          </div>
        </div>
      </Layout>
    </>
  );
};

export default SupportPage;
