import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { colorClasses } from "@/lib/theme";

interface PrivacyPolicyDialogProps {
  isOpen: boolean;
  onAccept: () => void;
  userId: string;
}

const PrivacyPolicyDialog = ({
  isOpen,
  onAccept,
  userId,
}: PrivacyPolicyDialogProps) => {
  const [hasRead, setHasRead] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAccept = async () => {
    if (!hasRead) {
      toast({
        title: "Please confirm you have read the policy",
        variant: "destructive",
      });
      return;
    }

    setIsAccepting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          privacy_policy_accepted: true,
          privacy_policy_accepted_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Privacy policy accepted",
        description: "Thank you for accepting our privacy policy",
      });
      onAccept();
    } catch (error) {
      console.error("Error accepting privacy policy:", error);
      toast({
        title: "Failed to accept privacy policy",
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Privacy Policy</DialogTitle>
          <DialogDescription>
            Please read and accept our privacy policy to continue
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold text-base mb-2">Data We Collect</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Account information (email, username, full name)</li>
                <li>Profile information (bio, avatar, posts)</li>
                <li>User-generated content (posts, comments, messages)</li>
                <li>Interaction data (likes, follows, search history)</li>
                <li>Device information for push notifications</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">
                How We Use Your Data
              </h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>To provide and improve our services</li>
                <li>To personalize your experience</li>
                <li>To communicate with you about updates and features</li>
                <li>To ensure platform security and prevent abuse</li>
                <li>To send you notifications you've opted into</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">Data Sharing</h3>
              <p>We do not sell your personal data. We may share data:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>
                  With other users as part of the platform's social features
                </li>
                <li>With service providers who help us operate the platform</li>
                <li>When required by law or to protect rights and safety</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">Your Rights</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Access and download your data</li>
                <li>Update or correct your information</li>
                <li>Delete your account and data</li>
                <li>Opt-out of marketing communications</li>
                <li>Control your privacy settings</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">Data Retention</h3>
              <p>
                We retain your data while your account is active. If you request
                account deletion, your data will be retained for 30 days before
                permanent deletion, allowing for account recovery if needed.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">Security</h3>
              <p>
                We implement industry-standard security measures to protect your
                data. However, no method of transmission over the internet is
                100% secure.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">Contact</h3>
              <p>
                For questions about this privacy policy, please contact us
                through the app's support section.
              </p>
              <p className="mt-3">
                <a
                  href="https://privacy-policy.cbee.online/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  View Full Privacy Policy →
                </a>
              </p>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="flex flex-col sm:flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="privacy-read"
              checked={hasRead}
              onCheckedChange={(checked) => setHasRead(checked as boolean)}
            />
            <label
              htmlFor="privacy-read"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I have read and understood the privacy policy
            </label>
          </div>
          <Button
            onClick={handleAccept}
            disabled={!hasRead || isAccepting}
            className={`w-full ${colorClasses.primaryBg} ${colorClasses.white} ${colorClasses.primaryBgHover}`}
          >
            {isAccepting ? "Accepting..." : "Accept and Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrivacyPolicyDialog;
