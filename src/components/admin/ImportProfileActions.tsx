import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Trash2, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface ImportProfile {
  id: string;
  name: string;
  partner_id: string;
  source_type: string;
  column_mappings: any;
  status_mappings: any;
  status_override_rules: any;
  engineer_mapping_rules: any;
  status_actions: any;
  gsheet_id?: string;
  gsheet_sheet_name?: string;
  is_active: boolean;
}

interface ImportProfileActionsProps {
  profile: ImportProfile;
  onUpdate: () => void;
}

export function ImportProfileActions({ profile, onUpdate }: ImportProfileActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDuplicate = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('partner_import_profiles')
        .insert({
          name: `${profile.name} (Copy)`,
          partner_id: profile.partner_id,
          source_type: profile.source_type,
          column_mappings: profile.column_mappings,
          status_mappings: profile.status_mappings,
          status_override_rules: profile.status_override_rules,
          engineer_mapping_rules: profile.engineer_mapping_rules,
          status_actions: profile.status_actions,
          gsheet_id: profile.gsheet_id,
          gsheet_sheet_name: profile.gsheet_sheet_name,
          is_active: false, // Start as inactive copy
        });

      if (error) throw error;

      toast({
        title: "Profile duplicated",
        description: "Import profile has been duplicated successfully",
      });

      queryClient.invalidateQueries({ queryKey: ['partner-import-profiles'] });
      onUpdate();
    } catch (error) {
      console.error('Error duplicating profile:', error);
      toast({
        title: "Error",
        description: "Failed to duplicate import profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('partner_import_profiles')
        .delete()
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: "Profile deleted",
        description: "Import profile has been deleted successfully",
      });

      queryClient.invalidateQueries({ queryKey: ['partner-import-profiles'] });
      onUpdate();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting profile:', error);
      toast({
        title: "Error",
        description: "Failed to delete import profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDuplicate} disabled={isLoading}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)} 
            disabled={isLoading}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Import Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{profile.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}