import { useState } from "react";
import { Button, Label, Textarea } from "@/components/ui";

export function CompleteTaskDialog(props: {
  taskTitle: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
        <h2 className="font-display text-lg font-bold text-foreground">Concluir tarefa</h2>
        <p className="mt-1 break-words text-sm text-muted-foreground">{props.taskTitle}</p>
        <Label htmlFor="complete-note" className="mt-4 block">
          Histórico (obrigatório)
        </Label>
        <Textarea
          id="complete-note"
          rows={4}
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="O que foi feito e como foi?"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={props.onCancel} disabled={props.saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => props.onConfirm(note.trim())}
            disabled={props.saving || !note.trim()}
          >
            Concluir
          </Button>
        </div>
      </div>
    </div>
  );
}
