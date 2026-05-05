import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Building2, Plus, ArrowLeft, Users, UserCheck, Trash2, Pencil, ExternalLink, FileText, Loader2, UserMinus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Unit { id: number; name: string; city: string | null; location: string | null; candidateCount: number; staffCount: number; }

interface StaffMember { id: number; fullName: string; email: string; role: string; salutation: string | null; employeeId: string | null; active: boolean; }

interface CandidateRow {
  id: number; candidateCode: string; fullName: string; email: string; phone: string | null;
  status: string; dateOfBirth: string | null; gender: string | null; qualification: string | null;
  collegeName: string | null; address: string | null; createdAt: string;
  documents: { id: number; docType: string; fileName: string; fileUrl: string | null }[];
}

interface UnitDetail { id: number; name: string; city: string | null; location: string | null; staff: StaffMember[]; candidates: CandidateRow[]; }

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", program_admin: "Program Admin",
  central_exam_coordinator: "Central Coordinator", unit_coordinator: "Unit Coordinator",
  doctor: "Doctor", student: "Student",
};
const ROLE_COLORS: Record<string, string> = {
  doctor: "bg-blue-100 text-blue-800", unit_coordinator: "bg-purple-100 text-purple-800",
  central_exam_coordinator: "bg-indigo-100 text-indigo-800", program_admin: "bg-orange-100 text-orange-800",
  super_admin: "bg-red-100 text-red-800",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800", approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800", interview_completed: "bg-blue-100 text-blue-800",
  allocated: "bg-purple-100 text-purple-800", waitlisted: "bg-gray-100 text-gray-800",
};

export default function UnitsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const canEdit = user?.role === "super_admin" || user?.role === "program_admin";

  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRow | null>(null);
  const [activeTab, setActiveTab] = useState<string>("staff");

  const [addOpen, setAddOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<Unit | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [addForm, setAddForm] = useState({ name: "", city: "", location: "" });

  const { data: units = [], isLoading } = useQuery<Unit[]>({
    queryKey: ["units"],
    queryFn: () => api.get<Unit[]>("/units"),
  });

  const { data: unitDetail, isLoading: detailLoading } = useQuery<UnitDetail>({
    queryKey: ["unit-detail", selectedUnitId],
    queryFn: () => api.get<UnitDetail>(`/units/${selectedUnitId}`),
    enabled: selectedUnitId !== null,
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof addForm) => api.post<Unit>("/units", data),
    onSuccess: () => {
      toast({ title: "Unit added" });
      qc.invalidateQueries({ queryKey: ["units"] });
      setAddOpen(false);
      setAddForm({ name: "", city: "", location: "" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; name: string; city: string; location: string }) =>
      api.patch<Unit>(`/units/${id}`, data),
    onSuccess: () => {
      toast({ title: "Unit updated" });
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["unit-detail", editUnit?.id] });
      setEditUnit(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/units/${id}`),
    onSuccess: () => {
      toast({ title: "Unit deleted" });
      qc.invalidateQueries({ queryKey: ["units"] });
      setDeleteConfirmId(null);
      if (selectedUnitId === deleteConfirmId) setSelectedUnitId(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeStaff = useMutation({
    mutationFn: (userId: number) => api.patch(`/users/${userId}`, { unitId: null }),
    onSuccess: () => {
      toast({ title: "Staff removed from unit" });
      qc.invalidateQueries({ queryKey: ["unit-detail", selectedUnitId] });
      qc.invalidateQueries({ queryKey: ["units"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeCandidate = useMutation({
    mutationFn: (candidateId: number) => api.patch(`/candidates/${candidateId}`, { unitId: null }),
    onSuccess: () => {
      toast({ title: "Candidate removed from unit" });
      qc.invalidateQueries({ queryKey: ["unit-detail", selectedUnitId] });
      qc.invalidateQueries({ queryKey: ["units"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateCandidateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.patch(`/candidates/${id}`, { status }),
    onSuccess: () => {
      toast({ title: "Status updated" });
      qc.invalidateQueries({ queryKey: ["unit-detail", selectedUnitId] });
      if (selectedCandidate) {
        setSelectedCandidate((prev) => prev ? { ...prev, status: updateCandidateStatus.variables?.status ?? prev.status } : prev);
      }
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Candidate detail view
  if (selectedCandidate) {
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedCandidate(null)} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Unit
          </Button>
          <Badge className={STATUS_COLORS[selectedCandidate.status] ?? ""} variant="secondary">
            {selectedCandidate.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Personal Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ["Candidate Code", selectedCandidate.candidateCode],
                ["Full Name", selectedCandidate.fullName],
                ["Email", selectedCandidate.email],
                ["Phone", selectedCandidate.phone],
                ["Date of Birth", selectedCandidate.dateOfBirth],
                ["Gender", selectedCandidate.gender],
                ["Address", selectedCandidate.address],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b pb-1.5 last:border-0">
                  <span className="font-medium text-muted-foreground">{k}</span>
                  <span className="text-right max-w-52 break-words">{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Education</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ["Qualification", selectedCandidate.qualification],
                ["College", selectedCandidate.collegeName],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b pb-1.5 last:border-0">
                  <span className="font-medium text-muted-foreground">{k}</span>
                  <span className="text-right max-w-52">{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {selectedCandidate.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded</p>
              ) : selectedCandidate.documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{d.docType}</span>
                    <span className="text-xs text-muted-foreground">({d.fileName})</span>
                  </div>
                  {d.fileUrl && (
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"
                      onClick={() => window.open(d.fileUrl!, "_blank")}>
                      <ExternalLink className="h-3 w-3" /> Open
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {canEdit && (
            <Card>
              <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm mb-1.5 block">Update Status</Label>
                  <Select value={selectedCandidate.status}
                    onValueChange={(v) => updateCandidateStatus.mutate({ id: selectedCandidate.id, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="interview_completed">Interview Completed</SelectItem>
                      <SelectItem value="waitlisted">Waitlisted</SelectItem>
                      <SelectItem value="allocated">Allocated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <Button variant="outline" className="w-full gap-2 text-destructive hover:text-destructive"
                  onClick={() => { removeCandidate.mutate(selectedCandidate.id); setSelectedCandidate(null); }}>
                  <UserMinus className="h-4 w-4" /> Remove from Unit
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Unit detail view
  if (selectedUnitId !== null) {
    const unit = units.find((u) => u.id === selectedUnitId);
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedUnitId(null)} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> All Units
            </Button>
            <div>
              <h1 className="text-xl font-bold">{unit?.name}</h1>
              {unit?.city && <p className="text-sm text-muted-foreground">{unit.city}</p>}
            </div>
          </div>
          {canEdit && unit && (
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => setEditUnit(unit)}>
              <Pencil className="h-3.5 w-3.5" /> Edit Unit
            </Button>
          )}
        </div>

        {detailLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="staff" className="gap-1.5">
                <UserCheck className="h-3.5 w-3.5" /> Staff ({unitDetail?.staff.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="candidates" className="gap-1.5">
                <Users className="h-3.5 w-3.5" /> Candidates ({unitDetail?.candidates.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="staff" className="mt-4">
              {!unitDetail?.staff.length ? (
                <div className="text-center py-12 text-muted-foreground">No staff assigned to this unit</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {unitDetail.staff.map((s) => (
                    <Card key={s.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm">{s.salutation ? `${s.salutation} ` : ""}{s.fullName}</p>
                              {!s.active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                            </div>
                            <Badge className={`text-xs mt-1 ${ROLE_COLORS[s.role] ?? "bg-muted"}`} variant="secondary">
                              {ROLE_LABELS[s.role] ?? s.role}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1.5">{s.email}</p>
                            {s.employeeId && <p className="text-xs text-muted-foreground">ID: {s.employeeId}</p>}
                          </div>
                          {canEdit && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeStaff.mutate(s.id)}
                              title="Remove from unit">
                              <UserMinus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="candidates" className="mt-4">
              {!unitDetail?.candidates.length ? (
                <div className="text-center py-12 text-muted-foreground">No candidates assigned to this unit</div>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Docs</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unitDetail.candidates.map((c) => (
                            <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="px-4 py-3 font-medium">{c.fullName}</td>
                              <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{c.candidateCode}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{c.email}</td>
                              <td className="px-4 py-3">
                                <Badge className={STATUS_COLORS[c.status] ?? ""} variant="secondary">
                                  {c.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-xs">{c.documents.length}</td>
                              <td className="px-4 py-3 text-right">
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                                  onClick={() => setSelectedCandidate(c)}>
                                  View
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Edit Unit Dialog */}
        <Dialog open={!!editUnit} onOpenChange={(o) => { if (!o) setEditUnit(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Unit</DialogTitle></DialogHeader>
            {editUnit && (
              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label>Hospital Name</Label>
                  <Input value={editUnit.name} onChange={(e) => setEditUnit((u) => u ? { ...u, name: e.target.value } : u)} />
                </div>
                <div className="space-y-1">
                  <Label>City</Label>
                  <Input value={editUnit.city ?? ""} onChange={(e) => setEditUnit((u) => u ? { ...u, city: e.target.value } : u)} />
                </div>
                <div className="space-y-1">
                  <Label>Address / Location</Label>
                  <Input value={editUnit.location ?? ""} onChange={(e) => setEditUnit((u) => u ? { ...u, location: e.target.value } : u)} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUnit(null)}>Cancel</Button>
              <Button disabled={editMutation.isPending} onClick={() => editUnit && editMutation.mutate({ id: editUnit.id, name: editUnit.name, city: editUnit.city ?? "", location: editUnit.location ?? "" })}>
                {editMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Units</h1>
          <p className="text-muted-foreground text-sm mt-1">{units.length} hospital units</p>
        </div>
        {canEdit && (
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add Unit
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : units.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No units yet</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {units.map((u) => (
            <Card key={u.id} className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => setSelectedUnitId(u.id)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">{u.name}</p>
                    {u.city && <p className="text-xs text-muted-foreground mt-0.5">{u.city}</p>}
                    {u.location && <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{u.location}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <UserCheck className="h-3 w-3" /> {u.staffCount} staff
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> {u.candidateCount} candidates
                      </span>
                    </div>
                  </div>
                  {canEdit && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(u.id); }}
                      title="Delete unit">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Unit Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Unit</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Hospital Name</Label>
              <Input placeholder="Sankara Eye Hospital - City" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>City</Label>
              <Input placeholder="Bangalore" value={addForm.city} onChange={(e) => setAddForm((f) => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Address / Location</Label>
              <Input placeholder="Varthur Road, Bangalore" value={addForm.location} onChange={(e) => setAddForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button disabled={!addForm.name || addMutation.isPending} onClick={() => addMutation.mutate(addForm)}>
              {addMutation.isPending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Unit?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will delete the unit. All staff and candidates assigned to it will be unassigned (not deleted).
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => deleteConfirmId !== null && deleteMutation.mutate(deleteConfirmId)}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
