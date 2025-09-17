import { useState, useEffect } from "react";
import { OrderSection } from "../OrderSectionLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { 
  StickyNote,
  Plus,
  Save,
  X,
  MessageSquare
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface OrderNote {
  id: string;
  note_content: string;
  created_at: string;
  created_by: string | null;
  creator_name?: string | null;
}

interface OrderNotesSectionProps {
  orderId: string;
  onUpdate?: () => void;
}

export function OrderNotesSection({ orderId, onUpdate }: OrderNotesSectionProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchNotes = async () => {
    try {
      // First get the notes
      const { data: notesData, error: notesError } = await supabase
        .from('order_notes')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

      // Then get the creator names from profiles
      const creatorIds = notesData?.map(note => note.created_by).filter(Boolean) || [];
      let profilesData: any[] = [];
      
      if (creatorIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', creatorIds);
          
        if (!profilesError) {
          profilesData = profiles || [];
        }
      }

      // Combine the data
      const notesWithCreators = notesData?.map(note => ({
        ...note,
        creator_name: profilesData.find(p => p.user_id === note.created_by)?.full_name || null
      })) || [];

      setNotes(notesWithCreators);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast({
        title: "Error",
        description: "Failed to load notes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('order_notes')
        .insert({
          order_id: orderId,
          note_content: newNoteContent.trim(),
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Note added successfully",
      });

      setNewNoteContent("");
      setIsAddingNote(false);
      fetchNotes();
      onUpdate?.();
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [orderId]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  };

  const getRelativeTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  return (
    <OrderSection 
      id="order-notes" 
      title="Order Notes" 
      icon={StickyNote} 
      defaultOpen={false}
    >
      <div className="space-y-4">
        {/* Add Note Button/Form */}
        {!isAddingNote ? (
          <Button
            onClick={() => setIsAddingNote(true)}
            variant="outline"
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        ) : (
          <Card className="p-4">
            <div className="space-y-3">
              <Textarea
                placeholder="Add a note about this order..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="min-h-[100px]"
                disabled={isSaving}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleAddNote}
                  disabled={!newNoteContent.trim() || isSaving}
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Note"}
                </Button>
                <Button
                  onClick={() => {
                    setIsAddingNote(false);
                    setNewNoteContent("");
                  }}
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Notes List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading notes...
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No notes added yet.</p>
            <p className="text-sm">Add a note to keep track of important information about this order.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <Card key={note.id} className="p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {note.creator_name || 'Unknown User'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {getRelativeTime(note.created_at)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(note.created_at)}
                    </span>
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-sm whitespace-pre-wrap mb-0">
                      {note.note_content}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </OrderSection>
  );
}