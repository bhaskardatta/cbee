// src/components/ReportButton.tsx
//
// Three-dot menu that opens the report dialog. Self-hides when the
// current user owns the post (RLS also denies, but no point teasing the
// affordance). Used by both `PostCard` (home feed) and `ReelOverlay`.

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import ReportDialog from "./ReportDialog";
import { cn } from "@/lib/utils";

interface ReportButtonProps {
  postId: string;
  postOwnerId: string;
  iconClassName?: string;
}

const ReportButton = ({
  postId,
  postOwnerId,
  iconClassName,
}: ReportButtonProps) => {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  // RLS already blocks self-reports server-side; this just hides the UI.
  if (!user || user.id === postOwnerId) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="More options"
            className="flex items-center justify-center active:scale-95 transition-transform"
          >
            <MoreVertical
              className={cn(
                "w-6 h-6 text-muted-foreground",
                iconClassName,
              )}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            Report post
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        postId={postId}
      />
    </>
  );
};

export default ReportButton;
