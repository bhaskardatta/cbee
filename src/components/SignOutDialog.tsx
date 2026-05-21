import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { LogOut, Trash2 } from "lucide-react";
import { colorClasses } from "@/lib/theme";

interface SignOutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
  userId: string;
}

const SignOutDialog = ({
  isOpen,
  onClose,
  onSignOut,
  userId,
}: SignOutDialogProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleNormalSignOut = () => {
    onSignOut();
    onClose();
  };

  const handleDeleteAndSignOut = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAndSignOut = async () => {
    setIsDeleting(true);
    try {
      // Mark account for deletion
      const { error } = await supabase
        .from("profiles")
        .update({
          account_deletion_requested_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Account marked for deletion",
        description:
          "Your data will be retained for 30 days before permanent deletion",
      });

      // Sign out after marking for deletion
      onSignOut();
      onClose();
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Error requesting account deletion:", error);
      toast({
        title: "Failed to request account deletion",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (showDeleteConfirm) {
    return (
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Confirm Account Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold">
                Your data will be retained for 30 days before permanent
                deletion.
              </p>
              <p>
                During this period, you can recover your account by logging in
                again. After 30 days, all your data including:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Profile information</li>
                <li>Posts and media</li>
                <li>Comments and likes</li>
                <li>Messages</li>
                <li>All other account data</li>
              </ul>
              <p className="font-semibold">
                will be permanently deleted and cannot be recovered.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAndSignOut}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Processing..." : "Yes, Delete My Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign Out</AlertDialogTitle>
          <AlertDialogDescription>
            Choose how you'd like to sign out
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 py-4">
          <Button
            onClick={handleNormalSignOut}
            className={`w-full justify-start ${colorClasses.primaryBg} ${colorClasses.white} ${colorClasses.primaryBgHover}`}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out Normally
          </Button>

          <Button
            onClick={handleDeleteAndSignOut}
            className="w-full justify-start bg-transparent hover:bg-red-600 hover:text-white text-gray-800 transition-colors duration-200"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Data and Sign Out
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel
            className={`${colorClasses.primaryBg} ${colorClasses.white} ${colorClasses.primaryBgHover} rounded-md px-4 py-2 border-none focus:outline-none focus:ring-0`}
          >
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SignOutDialog;
