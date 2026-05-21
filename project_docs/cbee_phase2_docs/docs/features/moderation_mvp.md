# Feature: Moderation MVP (Report Button)

**Goal:** Add the smallest possible content-reporting layer that satisfies Google Play and App Store policy requirements for user-generated content. ONE button, ONE table, ONE saved SQL query Swaroop runs in Supabase Studio.

**Estimated effort:** ~4 hours. See `docs/03_DECISIONS.md` ADR-010 for why this is in Phase 2 and not Phase 3.

---

## What ships

| Capability                                              | Status |
| ------------------------------------------------------- | ------ |
| Three-dot menu on every post (feed and reels)           | ✓      |
| "Report" item in the menu                               | ✓      |
| Report dialog with 7 canonical reasons + optional details | ✓    |
| One row per (reporter, post) — duplicate-proof          | ✓      |
| `reports` table with status workflow                    | ✓      |
| Admin-side saved SQL query for triage                   | ✓ (documented, not implemented) |
| Block user                                              | ✗ Phase 3+ |
| Notify reporter of action taken                         | ✗ Phase 3+ |
| Automatic content classification                        | ✗ Phase 3+ |
| Appeals flow                                            | ✗ Phase 3+ |
| Admin queue UI                                          | ✗ Phase 3+ |

---

## Why this matters legally

Google Play's User Generated Content policy requires:
1. An in-app system to flag objectionable content
2. A system for moderators (humans) to review and act
3. Removal of content that violates policy
4. A way to block abusive users

Apple has similar requirements. Without these, the apps can be rejected at submission.

Our Report MVP covers (1) and (3) directly, (2) via the admin SQL query Swaroop runs, and (4) is Phase 3 (we document it in the going-live guide as a known follow-up).

---

## New / changed files

| File                                          | Action  | Lines |
| --------------------------------------------- | ------- | ----- |
| `src/components/reels/ReportButton.tsx`       | NEW (reused in feed too) | ~120 |
| `src/components/ReportDialog.tsx`             | NEW     | ~140  |
| `src/hooks/useReport.ts`                      | NEW     | ~40   |
| `src/components/PostCard.tsx`                 | EDIT    | +5 lines (add three-dot menu) |
| `src/components/reels/ReelOverlay.tsx`        | EDIT    | (uses ReportButton — already in spec) |

The schema for `reports` lives in the Phase 2 migration — see `docs/02_DATA_MODEL.md`. RLS is already covered there.

---

## `useReport.ts` — the mutation hook

```ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export type ReportReason =
  | 'spam'
  | 'nudity_or_sexual'
  | 'violence_or_gore'
  | 'hate_speech'
  | 'not_pet_content'
  | 'harassment'
  | 'other';

interface ReportInput {
  postId: string;
  reason: ReportReason;
  details?: string;
}

export function useReport() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ postId, reason, details }: ReportInput) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          post_id: postId,
          reason,
          details: details ?? null,
        });

      if (error) {
        // 23505 = unique violation = user has already reported this post.
        // Treat as a success from the UX perspective.
        if (error.code === '23505') {
          return { alreadyReported: true };
        }
        throw error;
      }

      return { alreadyReported: false };
    },
    onSuccess: (data) => {
      toast.success(
        data.alreadyReported
          ? "You've already reported this post."
          : 'Thanks for letting us know. Our team will review.'
      );
    },
    onError: (err) => {
      toast.error('Could not submit report. Please try again.');
      console.error('Report failed:', err);
    },
  });
}
```

---

## `ReportDialog.tsx` — the dialog UI

shadcn Dialog. Radio group for reason. Textarea for optional details.

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useReport, ReportReason } from '@/hooks/useReport';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'nudity_or_sexual', label: 'Nudity or sexual content' },
  { value: 'violence_or_gore', label: 'Violence or gore' },
  { value: 'hate_speech', label: 'Hate speech or harassment' },
  { value: 'not_pet_content', label: "Doesn't seem to be about pets" },
  { value: 'harassment', label: "Bullying or targeted harassment" },
  { value: 'other', label: 'Something else' },
];

export default function ReportDialog({ open, onOpenChange, postId }: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const reportMutation = useReport();

  const handleSubmit = async () => {
    if (!reason) return;
    await reportMutation.mutateAsync({ postId, reason, details: details.trim() || undefined });
    onOpenChange(false);
    setReason(null);
    setDetails('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report this post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Your report is anonymous. Our team will review and take action if it violates our community guidelines.
          </p>

          <RadioGroup value={reason ?? ''} onValueChange={(v) => setReason(v as ReportReason)}>
            {REASONS.map(r => (
              <div key={r.value} className="flex items-center space-x-2 py-1">
                <RadioGroupItem value={r.value} id={r.value} />
                <Label htmlFor={r.value} className="cursor-pointer flex-1">{r.label}</Label>
              </div>
            ))}
          </RadioGroup>

          {reason === 'other' && (
            <Textarea
              placeholder="Help us understand the issue..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              className="resize-none"
              rows={3}
            />
          )}
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-[#26A69A] hover:bg-[#1f8c81]"
            onClick={handleSubmit}
            disabled={!reason || reportMutation.isPending}
          >
            {reportMutation.isPending ? 'Submitting…' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## `ReportButton.tsx` — three-dot menu trigger

Used in both `PostCard` (feed) and `ReelOverlay` (reels).

```tsx
import { useState } from 'react';
import { MoreVerticalIcon, FlagIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ReportDialog from '@/components/ReportDialog';
import { useAuth } from '@/contexts/AuthContext';

interface ReportButtonProps {
  postId: string;
  postOwnerId: string;
  iconClassName?: string;
}

export default function ReportButton({ postId, postOwnerId, iconClassName }: ReportButtonProps) {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Don't let users report their own posts (also enforced by RLS)
  if (user?.id === postOwnerId) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button aria-label="Post options" className={iconClassName ?? "p-2"}>
            <MoreVerticalIcon className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setDialogOpen(true)} className="text-red-600">
            <FlagIcon className="h-4 w-4 mr-2" />
            Report post
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportDialog open={dialogOpen} onOpenChange={setDialogOpen} postId={postId} />
    </>
  );
}
```

In `PostCard.tsx`, add this to the header next to (or replacing) the existing post-actions menu:

```tsx
<ReportButton postId={post.id} postOwnerId={post.user_id} />
```

In `ReelOverlay.tsx`, add as a vertical-rail item below share:

```tsx
<ReportButton
  postId={reel.id}
  postOwnerId={reel.user_id}
  iconClassName="p-2 text-white drop-shadow-lg"
/>
```

---

## Admin triage workflow (Swaroop's side)

This is documented in `docs/handoff/going_live.md` and the Welcome Pack, but summary here:

Swaroop opens Supabase Studio → SQL Editor → runs this saved query daily (or on alert):

```sql
-- All open reports, newest first, with the offending post URL
select
  r.id as report_id,
  r.created_at,
  r.reason,
  r.details,
  r.status,
  r.reporter_id,
  p.id as post_id,
  p.user_id as post_author_id,
  p.media_url,
  p.caption,
  p.created_at as post_created_at
from public.reports r
join public.posts p on r.post_id = p.id
where r.status = 'open'
order by r.created_at desc
limit 100;
```

For a report Swaroop wants to act on (e.g., the post is genuinely policy-violating):

```sql
-- 1. Delete the post (RLS allows the user, but Swaroop runs as service role in Studio so no issue)
delete from public.posts where id = '<post_id>';

-- 2. Mark all related reports as actioned
update public.reports
set status = 'actioned',
    reviewed_at = now()
where post_id = '<post_id>';
```

To dismiss a false report:

```sql
update public.reports
set status = 'dismissed', reviewed_at = now()
where id = '<report_id>';
```

(Marking individually rather than by post is the right pattern for false-positive reports of legitimate content.)

---

## Edge cases

| Case                                                       | Behavior                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| User reports the same post twice                           | Unique constraint trips; we show "You've already reported this post."    |
| User tries to report their own post                        | Button doesn't render (`postOwnerId === user.id` check + RLS double-check) |
| User reports an already-deleted post                       | Post is cascaded; report row also cascades to delete (FK). No error.    |
| Multiple users report the same post                        | Multiple rows in `reports`, one per reporter. Admin query groups by post when triaging. |
| Report submitted while offline                             | Mutation fails; we toast retry. Don't persist offline-pending reports in Phase 2. |

---

## Acceptance criteria (DoD)

- [ ] Three-dot menu appears on every PostCard for posts not owned by the viewer.
- [ ] Three-dot menu appears on every ReelSlide for reels not owned by the viewer.
- [ ] Tapping "Report post" opens the dialog with all 7 reasons.
- [ ] Selecting "Something else" reveals the optional details textarea.
- [ ] Submitting writes a row to `reports` (verify in Supabase Studio).
- [ ] Reporting the same post twice surfaces the "already reported" message.
- [ ] Reporting via RLS-blocked attempt (e.g., own post) fails silently (button shouldn't be visible).
- [ ] Swaroop can run the triage SQL query in Supabase Studio and see open reports.

---

## Future Phase 3 work (so Swaroop knows what's coming)

When cbee passes ~1k DAU, the report queue gets too big to triage manually. Phase 3 work:
- Small admin Next.js dashboard (separate deploy) that wraps the same SQL queries with a UI
- User-block mechanism (`blocked_users` table)
- Automatic content flagging via a third-party (Google Cloud Vision SafeSearch, Hive, Sightengine)
- Notification to reporter when their report is actioned

These are not in Phase 2 budget. Document the trigger thresholds in handoff.

---

**Next:** `docs/build/dev_environment.md` for local setup, or other build docs.
