import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/overlays/alert-dialog";

interface ConfirmLeaveProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeave: () => void;
}

/** Asked when the back action would drop changes not saved yet. */
export function ConfirmLeave({ open, onOpenChange, onLeave }: ConfirmLeaveProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Abandonner les modifications ?</AlertDialogTitle>
          <AlertDialogDescription>Ce qui n’a pas été enregistré sera perdu.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuer</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onLeave}>
            Abandonner
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
