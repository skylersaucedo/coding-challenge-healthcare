import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Patient, Stage } from "@/types";
import { apiFetch } from "@/api/client";
import PatientCard from "./PatientCard";
import PatientDetailDrawer from "./PatientDetailDrawer";

const COLUMNS: { id: Stage; label: string; capacity: number; color: string }[] = [
  { id: "intake", label: "Intake", capacity: 20, color: "bg-blue-50 border-blue-200" },
  { id: "vitals", label: "Vitals", capacity: 10, color: "bg-purple-50 border-purple-200" },
  { id: "doc_visit", label: "Doc Visit", capacity: 5, color: "bg-amber-50 border-amber-200" },
  { id: "post_visit", label: "Post-Visit", capacity: 4, color: "bg-green-50 border-green-200" },
];

export default function KanbanBoard() {
  const queryClient = useQueryClient();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["patients"],
    queryFn: () => apiFetch<Patient[]>("/patients"),
    refetchInterval: 30_000,
  });

  const moveMutation = useMutation({
    mutationFn: ({
      patientId,
      stage,
      stage_order,
    }: {
      patientId: string;
      stage: Stage;
      stage_order: number;
    }) =>
      apiFetch<Patient>(`/patients/${patientId}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage, stage_order }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patients"] }),
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    moveMutation.mutate({
      patientId: draggableId,
      stage: destination.droppableId as Stage,
      stage_order: destination.index,
    });

    // Optimistic update
    queryClient.setQueryData<Patient[]>(["patients"], (prev = []) =>
      prev.map((p) =>
        p.id === draggableId
          ? { ...p, stage: destination.droppableId as Stage, stage_order: destination.index }
          : p
      )
    );
  };

  const patientsInStage = (stage: Stage) =>
    patients
      .filter((p) => p.stage === stage)
      .sort((a, b) => a.stage_order - b.stage_order);

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 h-full overflow-x-auto p-4 items-start">
          {COLUMNS.map((col) => {
            const colPatients = patientsInStage(col.id);
            const pct = Math.round((colPatients.length / col.capacity) * 100);

            return (
              <div key={col.id} className="flex-shrink-0 w-72">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="font-semibold text-sm">{col.label}</h3>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      pct >= 90
                        ? "bg-red-100 text-red-700"
                        : pct >= 70
                          ? "bg-amber-100 text-amber-700"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {colPatients.length}/{col.capacity}
                  </span>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-24 rounded-xl border p-2 transition-colors ${col.color} ${
                        snapshot.isDraggingOver ? "ring-2 ring-primary ring-offset-1" : ""
                      }`}
                    >
                      {colPatients.map((patient, index) => (
                        <Draggable key={patient.id} draggableId={patient.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                opacity: snapshot.isDragging ? 0.85 : 1,
                              }}
                            >
                              <PatientCard
                                patient={patient}
                                onClick={() => setSelectedPatient(patient)}
                              />

                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <PatientDetailDrawer
        patient={selectedPatient}
        onClose={() => setSelectedPatient(null)}
      />
    </>
  );
}
