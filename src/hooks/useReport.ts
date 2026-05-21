// src/hooks/useReport.ts
//
// Moderation MVP — `reports` insert mutation.
//
// Schema (`docs/02_DATA_MODEL.md`):
//   reports(id, reporter_id, post_id, reason, details?, status='open',
//           created_at, reviewed_at?, reviewed_by?)
// Constraints:
//   - reason ∈ {spam, nudity_or_sexual, violence_or_gore, hate_speech,
//                not_pet_content, harassment, other}
//   - UNIQUE (reporter_id, post_id)   → can only report a post once
// RLS:
//   - INSERT allowed only when `reporter_id = auth.uid()` AND the post
//     is NOT owned by the reporter (enforced server-side as a backup;
//     the UI also hides the button on own posts).
//
// We surface the 23505 unique-violation as a friendly "already reported"
// toast rather than an error — Phase 2 doesn't need a separate "your
// report queue" UI.

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export const REPORT_REASONS = [
  { value: "spam", label: "Spam or scam" },
  { value: "nudity_or_sexual", label: "Nudity or sexual content" },
  { value: "violence_or_gore", label: "Violence or gore" },
  { value: "hate_speech", label: "Hate speech or symbols" },
  { value: "not_pet_content", label: "Not pet-related" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = typeof REPORT_REASONS[number]["value"];

interface ReportPayload {
  postId: string;
  reason: ReportReason;
  details?: string;
}

interface ReportResult {
  alreadyReported: boolean;
}

export const useReport = () => {
  const { user } = useAuth();

  return useMutation<ReportResult, Error, ReportPayload>({
    mutationFn: async ({ postId, reason, details }) => {
      if (!user) {
        throw new Error("You must be signed in to report a post.");
      }
      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        post_id: postId,
        reason,
        details: details?.trim() ? details.trim() : null,
      });
      if (error) {
        // Postgres unique_violation — same reporter already filed against
        // this post. Surface as success-with-flag, not an error.
        if (error.code === "23505") {
          return { alreadyReported: true };
        }
        throw error;
      }
      return { alreadyReported: false };
    },
    onSuccess: (result) => {
      if (result.alreadyReported) {
        toast({
          title: "Already reported",
          description: "You've already reported this post.",
        });
      } else {
        toast({
          title: "Thanks for the report",
          description: "Our team will review this shortly.",
        });
      }
    },
    onError: (err) => {
      toast({
        title: "Couldn't submit report",
        description:
          err.message ?? "Please check your connection and try again.",
        variant: "destructive",
      });
    },
  });
};
