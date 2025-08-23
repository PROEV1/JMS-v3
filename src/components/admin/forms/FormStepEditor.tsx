import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, GripVertical, Trash2, Settings } from 'lucide-react';
import { SurveyStep, SurveyField, SurveyFormSchema } from '@/types/survey-forms';
import { FormFieldEditor } from './FormFieldEditor';

interface FormStepEditorProps {
  step: SurveyStep;
  onUpdate: (step: SurveyStep) => void;
  onDelete: () => void;
  onAddField: () => void;
  schema: SurveyFormSchema;
  canEdit: boolean;
}

export function FormStepEditor({
  step,
  onUpdate,
  onDelete,
  onAddField,
  schema,
  canEdit
}: FormStepEditorProps) {
  const [selectedFieldKey, setSelectedFieldKey] = React.useState<string | null>(null);

  const selectedField = step.fields.find(field => field.key === selectedFieldKey);

  const handleFieldReorder = (result: DropResult) => {
    if (!result.destination || !canEdit) return;

    const newFields = Array.from(step.fields);
    const [reorderedField] = newFields.splice(result.source.index, 1);
    newFields.splice(result.destination.index, 0, reorderedField);

    // Update order numbers
    const updatedFields = newFields.map((field, index) => ({
      ...field,
      order: index
    }));

    onUpdate({
      ...step,
      fields: updatedFields
    });
  };

  const handleFieldUpdate = (updatedField: SurveyField) => {
    const updatedFields = step.fields.map(field =>
      field.key === updatedField.key ? updatedField : field
    );

    onUpdate({
      ...step,
      fields: updatedFields
    });
  };

  const handleFieldDelete = (fieldKey: string) => {
    const updatedFields = step.fields
      .filter(field => field.key !== fieldKey)
      .map((field, index) => ({ ...field, order: index }));

    onUpdate({
      ...step,
      fields: updatedFields
    });

    if (selectedFieldKey === fieldKey) {
      setSelectedFieldKey(null);
    }
  };

  const getFieldTypeLabel = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="h-full flex">
      {/* Step Content Editor */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl">
          {/* Step Settings */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Step Settings
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDelete}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Step Title</label>
                <Input
                  value={step.title}
                  onChange={(e) => onUpdate({ ...step, title: e.target.value })}
                  placeholder="Enter step title"
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  value={step.description || ''}
                  onChange={(e) => onUpdate({ ...step, description: e.target.value })}
                  placeholder="Enter step description"
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Progress Label</label>
                <Input
                  value={step.progressLabel || ''}
                  onChange={(e) => onUpdate({ ...step, progressLabel: e.target.value })}
                  placeholder="Short label for progress indicator"
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </Card>

          {/* Fields */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Fields
                {canEdit && (
                  <Button size="sm" onClick={onAddField}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Field
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {step.fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No fields added yet</p>
                  {canEdit && (
                    <p className="text-sm mt-1">Click "Add Field" to get started</p>
                  )}
                </div>
              ) : (
                <DragDropContext onDragEnd={handleFieldReorder}>
                  <Droppable droppableId="fields" isDropDisabled={!canEdit}>
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {step.fields.map((field, index) => (
                          <Draggable
                            key={field.key}
                            draggableId={field.key}
                            index={index}
                            isDragDisabled={!canEdit}
                          >
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`cursor-pointer transition-colors ${
                                  selectedFieldKey === field.key
                                    ? 'ring-2 ring-primary'
                                    : ''
                                } ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                                onClick={() => setSelectedFieldKey(field.key)}
                              >
                                <CardContent className="p-3">
                                  <div className="flex items-center gap-3">
                                    {canEdit && (
                                      <div
                                        {...provided.dragHandleProps}
                                        className="text-muted-foreground hover:text-foreground"
                                      >
                                        <GripVertical className="w-4 h-4" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline" className="text-xs">
                                          {getFieldTypeLabel(field.type)}
                                        </Badge>
                                        {field.settings.required && (
                                          <Badge variant="secondary" className="text-xs">
                                            Required
                                          </Badge>
                                        )}
                                        <span className="font-medium text-sm truncate">
                                          {field.settings.label}
                                        </span>
                                      </div>
                                      {field.settings.helpText && (
                                        <p className="text-xs text-muted-foreground truncate">
                                          {field.settings.helpText}
                                        </p>
                                      )}
                                    </div>
                                    <Settings className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right Sidebar - Field Settings */}
      {selectedField && (
        <div className="w-96 border-l bg-background overflow-y-auto">
          <FormFieldEditor
            field={selectedField}
            onUpdate={handleFieldUpdate}
            onDelete={() => handleFieldDelete(selectedField.key)}
            schema={schema}
            stepKey={step.key}
            canEdit={canEdit}
          />
        </div>
      )}
    </div>
  );
}