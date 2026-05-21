// src/components/ReportDialog.tsx
//
// 7-reason report modal. The reasons enum matches the
// `reports_reason_check` CHECK constraint in Postgres — see
// `docs/02_DATA_MODEL.md` and `useReport.ts`.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  REPORT_REASONS,
  type ReportReason,
  useReport,
} from "@/hooks/useReport";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

const DETAILS_MAX = 500;

const ReportDialog = ({ open, onOpenChange, postId }: ReportDialogProps) => {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const { mutateAsync, isPending } = useReport();

  // Reset form whenever the dialog re-opens fresh.
  useEffect(() => {
    if (open) {
      setReason("");
      setDetails("");
    }
  }, [open]);

  const submit = async () => {
    if (!reason) return;
    await mutateAsync({
      postId,
      reason: reason as ReportReason,
      details: reason === "other" ? details : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this post</DialogTitle>
          <DialogDescription>
            Tell us what's wrong so we can review it. Your report is private.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={reason}
          onValueChange={(v) => setReason(v as ReportReason)}
          className="space-y-2 max-h-[40vh] overflow-y-auto"
        >
          {REPORT_REASONS.map((r) => (
            <div
              key={r.value}
              className="flex items-center space-x-3 rounded-md border border-border px-3 py-2"
            >
              <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
              <Label
                htmlFor={`reason-${r.value}`}
                className="flex-1 cursor-pointer text-sm font-normal"
              >
                {r.label}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {reason === "other" && (
          <div className="space-y-1">
            <Label htmlFor="report-details" className="text-xs">
              Tell us more (optional)
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, DETAILS_MAX))}
              maxLength={DETAILS_MAX}
              placeholder="Describe what's wrong with this post…"
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground text-right">
              {details.length}/{DETAILS_MAX}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!reason || isPending}
            className="bg-[#26A69A] text-white hover:bg-[#26A69A]/90"
          >
            {isPending ? "Submitting…" : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
