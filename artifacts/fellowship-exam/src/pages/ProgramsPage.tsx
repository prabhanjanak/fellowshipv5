import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, GraduationCap, Users, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Program {
  id: number;
  name: string;
  code: string;
  description: string | null;
  academicYear: string;
  totalSeats: number;
  specialityCount: number;
  candidateCount: number;
}

export default function ProgramsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const canManage = ["super_admin", "program_admin"].includes(user?.role ?? "");
  const [form, setForm] = useState({ name: "", code: "", description: "", academicYear: "2026" });

  const { data: programs = [], isLoading } = useQuery<Program[]>({
    queryKey: ["programs"],
    queryFn: () => api.get<Program[]>("/programs"),
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof form) => api.post<Program>("/programs", data),
    onSuccess: () => {
      toast({ title: "Program created" });
      qc.invalidateQueries({ queryKey: ["programs"] });
      setAddOpen(false);
      setForm({ name: "", code: "", description: "", academicYear: "2026" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Programs</h1>
          <p className="text-muted-foreground text-sm mt-1">{programs.length} fellowship programs</p>
        </div>
        {canManage && (
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add Program
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : programs.length === 0 ? (
        <div className="text-center py-12">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No programs yet</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {programs.map((p) => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                  </div>
                  <Badge variant="secondary">{p.academicYear}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-6 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Star className="h-3.5 w-3.5" />{p.specialityCount} Specialities
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />{p.candidateCount} Candidates
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">{p.totalSeats} seats</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono">{p.code}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Program</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {[
              { field: "name", label: "Program Name", placeholder: "Fellowship Program June 2026" },
              { field: "code", label: "Code", placeholder: "FP-JUN-2026" },
              { field: "academicYear", label: "Academic Year", placeholder: "2026" },
              { field: "description", label: "Description", placeholder: "Optional description" },
            ].map(({ field, label, placeholder }) => (
              <div key={field} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  placeholder={placeholder}
                  value={form[field as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.name || !form.code || !form.academicYear || addMutation.isPending}
              onClick={() => addMutation.mutate(form)}
            >
              {addMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
