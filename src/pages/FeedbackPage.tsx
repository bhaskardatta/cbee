import { Send, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";
import AppNavbar from "@/components/AppNavbar";
import Layout from "@/components/Layout";

const FeedbackPage = () => {
  const handleSubmitFeedback = () => {
    window.location.href = "https://forms.gle/rY7Eh9TuzdAGpaKc9";
  };

  return (
    <>
      <AppHeader title="Feedback" showBackButton />
      <AppNavbar />

      <Layout>
        <div className="px-4 py-6 pb-24 max-w-md mx-auto">
          <div className="text-center mb-8">
            <div
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#e4f6ffff" }}
            >
              <Heart className="w-10 h-10 text-primary" fill="currentColor" />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-2">
              Share Your Feedback
            </h1>

            <p className="text-muted-foreground">
              We value your thoughts to improve Cbee!
            </p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Feedback Description */}
              <div>
                <h2 className="text-sm font-medium text-foreground mb-2">
                  Feedback
                </h2>

                <ul className="text-muted-foreground text-sm space-y-2 leading-relaxed list-disc pl-5">
                  <li>🔥 Share your valuable feedback to help us grow.</li>
                  <li>⭐ Suggest new ideas or features we can implement.</li>
                  <li>
                    🥰 Report any bugs or issues you notice while using the app.
                  </li>
                  <li>
                    💵 If your feedback is valuable, you will be rewarded with
                    points.
                  </li>
                </ul>
              </div>

              {/* Redirect Button */}
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-[#26A69A]/90"
                onClick={handleSubmitFeedback}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Feedback
              </Button>

              <p className="text-xs text-muted-foreground mt-2 text-center">
                You will be redirected to our official feedback form.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </>
  );
};

export default FeedbackPage;
