import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, GripVertical, Eye, Save, Rocket } from 'lucide-react';
import { SurveyFormSchema, SurveyStep, SurveyField, DEFAULT_EV_INSTALL_TEMPLATE } from '@/types/survey-forms';
import { FormStepEditor } from './FormStepEditor';
import { FormFieldPalette } from './FormFieldPalette';
import { FormPreviewModal } from './FormPreviewModal';
import { useToast } from '@/hooks/use-toast';

interface SurveyFormBuilderProps {
  schema: SurveyFormSchema;
  onSchemaChange: (schema: SurveyFormSchema) => void;
  onSave: () => void;
  onPublish: () => void;
  canPublish: boolean;
  isPublished: boolean;
  saving?: boolean;
  publishing?: boolean;
}

export function SurveyFormBuilder({
  schema,
  onSchemaChange,
  onSave,
  onPublish,
  canPublish,
  isPublished,
  saving,
  publishing
}: SurveyFormBuilderProps) {
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>(
    schema.steps.length > 0 ? schema.steps[0].key : null
  );
  const [showPreview, setShowPreview] = useState(false);
  const [showFieldPalette, setShowFieldPalette] = useState(false);
  const { toast } = useToast();

  const selectedStep = schema.steps.find(step => step.key === selectedStepKey);

  const handleStepReorder = (result: DropResult) => {
    if (!result.destination) return;

    const newSteps = Array.from(schema.steps);
    const [reorderedStep] = newSteps.splice(result.source.index, 1);
    newSteps.splice(result.destination.index, 0, reorderedStep);

    // Update order numbers
    const updatedSteps = newSteps.map((step, index) => ({
      ...step,
      order: index
    }));

    onSchemaChange({
      ...schema,
      steps: updatedSteps
    });
  };

  const handleAddStep = () => {
    const newStepKey = `step_${Date.now()}`;
    const newStep: SurveyStep = {
      key: newStepKey,
      title: 'New Step',
      description: '',
      progressLabel: 'Step',
      fields: [],
      order: schema.steps.length
    };

    onSchemaChange({
      ...schema,
      steps: [...schema.steps, newStep]
    });

    setSelectedStepKey(newStepKey);
  };

  const handleUpdateStep = (updatedStep: SurveyStep) => {
    const updatedSteps = schema.steps.map(step =>
      step.key === updatedStep.key ? updatedStep : step
    );

    onSchemaChange({
      ...schema,
      steps: updatedSteps
    });
  };

  const handleDeleteStep = (stepKey: string) => {
    if (schema.steps.length <= 1) {
      toast({
        title: "Cannot delete step",
        description: "Form must have at least one step",
        variant: "destructive"
      });
      return;
    }

    const updatedSteps = schema.steps
      .filter(step => step.key !== stepKey)
      .map((step, index) => ({ ...step, order: index }));

    onSchemaChange({
      ...schema,
      steps: updatedSteps
    });

    // Select another step
    if (selectedStepKey === stepKey) {
      setSelectedStepKey(updatedSteps[0]?.key || null);
    }
  };

  const handleAddFromTemplate = () => {
    onSchemaChange(DEFAULT_EV_INSTALL_TEMPLATE.schema);
    setSelectedStepKey(DEFAULT_EV_INSTALL_TEMPLATE.schema.steps[0]?.key || null);
    toast({
      title: "Template added",
      description: "EV Install template has been loaded"
    });
  };

  const handleAddField = (field: SurveyField) => {
    if (!selectedStep) return;

    const newField: SurveyField = {
      ...field,
      key: `${selectedStep.key}_${field.type}_${Date.now()}`,
      order: selectedStep.fields.length
    };

    const updatedStep: SurveyStep = {
      ...selectedStep,
      fields: [...selectedStep.fields, newField]
    };

    handleUpdateStep(updatedStep);
    setShowFieldPalette(false);
  };

  const validationErrors = [];
  if (schema.steps.length === 0) {
    validationErrors.push("Form must have at least one step");
  }
  if (schema.steps.some(step => step.fields.length === 0)) {
    validationErrors.push("All steps must have at least one field");
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <div className="border-b bg-background p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Form Builder</h1>
          <p className="text-sm text-muted-foreground">{schema.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleAddFromTemplate}
            disabled={isPublished}
          >
            Add from Template
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || isPublished}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button
            onClick={onPublish}
            disabled={!canPublish || validationErrors.length > 0 || publishing}
          >
            <Rocket className="w-4 h-4 mr-2" />
            Publish
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Steps */}
        <div className="w-80 border-r bg-background overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium">Steps</h2>
              <Button
                size="sm"
                onClick={handleAddStep}
                disabled={isPublished}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <DragDropContext onDragEnd={handleStepReorder}>
              <Droppable droppableId="steps" isDropDisabled={isPublished}>
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {schema.steps.map((step, index) => (
                      <Draggable
                        key={step.key}
                        draggableId={step.key}
                        index={index}
                        isDragDisabled={isPublished}
                      >
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`cursor-pointer transition-colors ${
                              selectedStepKey === step.key
                                ? 'ring-2 ring-primary'
                                : ''
                            } ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                            onClick={() => setSelectedStepKey(step.key)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <div
                                  {...provided.dragHandleProps}
                                  className="mt-1 text-muted-foreground hover:text-foreground"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="secondary" className="text-xs">
                                      {index + 1}
                                    </Badge>
                                    <span className="font-medium text-sm truncate">
                                      {step.title}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {step.fields.length} field{step.fields.length !== 1 ? 's' : ''}
                                  </p>
                                </div>
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

            {validationErrors.length > 0 && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <h3 className="text-sm font-medium text-destructive mb-2">Validation Errors:</h3>
                <ul className="text-xs text-destructive space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Center - Form Editor */}
        <div className="flex-1 overflow-y-auto">
          {selectedStep ? (
            <FormStepEditor
              step={selectedStep}
              onUpdate={handleUpdateStep}
              onDelete={() => handleDeleteStep(selectedStep.key)}
              onAddField={() => setShowFieldPalette(true)}
              schema={schema}
              canEdit={!isPublished}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="text-lg mb-2">No steps created yet</p>
                <p className="text-sm">Add a step to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showPreview && (
        <FormPreviewModal
          schema={schema}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showFieldPalette && (
        <FormFieldPalette
          onAddField={handleAddField}
          onClose={() => setShowFieldPalette(false)}
        />
      )}
    </div>
  );
}