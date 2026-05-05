import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, UserPlus, Building2, Edit2, Trash2, KeyRound, BadgeCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RoleAvatar } from "@/components/RoleAvatar";

interface User {
  id: number; email: string; salutation: string | null; fullName: string;
  employeeId: string | null; designation: string | null; gender: string | null;
  avatarSeed: string | null; role: string;
  active: boolean; unitId: number | null; unitName: string | null;
  forcePasswordReset: boolean;
}
interface Unit { id: number; name: string; city: string; }

const SALUTATIONS = ["Dr.", "Mr.", "Ms.", "Mrs.", "Prof."];

const roleColors: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800",
  program_admin: "bg-orange-100 text-orange-800",
  central_exam_coordinator: "bg-blue-100 text-blue-800",
  unit_coordinator: "bg-cyan-100 text-cyan-800",
  doctor: "bg-purple-100 text-purple-800",
  student: "bg-gray-100 text-gray-800",
};

const roleLabel: Record<string, string> = {
  super_admin: "Super Admin",
  program_admin: "Program Admin",
  central_exam_coordinator: "Central Exam Coordinator",
  unit_coordinator: "Unit Coordinator",
  doctor: "Doctor / Interviewer",
  student: "Student / Candidate",
};

const ALL_ROLES = [
  { value: "program_admin", label: "Program Admin" },
  { value: "central_exam_coordinator", label: "Central Exam Coordinator" },
  { value: "unit_coordinator", label: "Unit Coordinator" },
  { value: "doctor", label: "Doctor / Interviewer" },
  { value: "student", label: "Student / Candidate" },
];

const COORDINATOR_ROLES = [
  { value: "central_exam_coordinator", label: "Central Exam Coordinator" },
  { value: "unit_coordinator", label: "Unit Coordinator" },
  { value: "doctor", label: "Doctor / Interviewer" },
];

const EMPTY_FORM = {
  salutation: "", fullName: "", email: "", employeeId: "",
  designation: "", gender: "", avatarSeed: "",
  role: "unit_coordinator", unitId: "",
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPw, setResetPw] = useState("Welcome@123");

  const isSuperAdmin = me?.role === "super_admin";
  const availableRoles = isSuperAdmin ? ALL_ROLES : COORDINATOR_ROLES;

  const [form, setForm] = useState(EMPTY_FORM);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
  });

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["units"],
    queryFn: () => api.get<Unit[]>("/units"),
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.post<User>("/users", {
        ...data,
        salutation: data.salutation || null,
        employeeId: data.employeeId || null,
        designation: data.designation || null,
        gender: data.gender || null,
        avatarSeed: data.avatarSeed || null,
        unitId: data.unitId ? Number(data.unitId) : null,
      }),
    onSuccess: () => {
      toast({ title: "User created", description: "Initial password: Welcome@123" });
      qc.invalidateQueries({ queryKey: ["users"] });
      setAddOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> & { avatarSeed?: string | null } }) =>
      api.patch<User>(`/users/${id}`, data),
    onSuccess: () => { toast({ title: "User updated" }); qc.invalidateQueries({ queryKey: ["users"] }); setEditUser(null); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => { toast({ title: "User deleted" }); qc.invalidateQueries({ queryKey: ["users"] }); setDeleteUser(null); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: number; newPassword: string }) =>
      api.post("/auth/admin-reset-password", { userId, newPassword }),
    onSuccess: () => { toast({ title: "Password reset successfully" }); setResetUser(null); setResetPw("Welcome@123"); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const allRoles = Array.from(new Set(users.map((u) => u.role))).sort();
  const filtered = users.filter((u) => {
    const matchSearch =
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.unitName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.employeeId ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.designation ?? "").toLowerCase().includes(search.toLowerCase());
    return matchSearch && (roleFilter === "all" || u.role === roleFilter);
  });

  const displayName = (u: User) => [u.salutation, u.fullName].filter(Boolean).join(" ");

  const isFormValid = form.fullName && form.email && form.employeeId && form.designation && form.gender && form.unitId && form.role;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{filtered.length} of {users.length} users</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" /> Add User
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, employee ID, designation or unit…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {allRoles.map((r) => <SelectItem key={r} value={r}>{roleLabel[r] ?? r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading users…</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Designation</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Emp ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unit</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <RoleAvatar role={u.role} size="sm" />
                          <div>
                            <p className="font-medium">{displayName(u)}</p>
                            {u.forcePasswordReset && (
                              <span className="text-[10px] text-amber-600 font-medium">⚠ Pending reset</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{u.designation ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        {u.employeeId ? (
                          <span className="flex items-center gap-1 text-xs font-mono text-primary">
                            <BadgeCheck className="h-3 w-3 shrink-0" />{u.employeeId}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={roleColors[u.role] ?? "bg-gray-100 text-gray-800"} variant="secondary">
                          {roleLabel[u.role] ?? u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {u.unitName ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3 shrink-0" />{u.unitName}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.active ? "default" : "secondary"} className="text-[10px]">
                          {u.active ? "Active" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isSuperAdmin && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Reset password"
                              onClick={() => { setResetUser(u); setResetPw("Welcome@123"); }}>
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit"
                            onClick={() => setEditUser(u)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          {u.role !== "super_admin" && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                              title="Delete" onClick={() => setDeleteUser(u)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Alert className="text-xs py-2">
              <AlertDescription>New users will receive initial password: <code className="font-mono">Welcome@123</code> and must reset it on first login.</AlertDescription>
            </Alert>

            {/* Avatar preview */}
            {form.role && (
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <RoleAvatar role={form.role} size="md" showRing />
                <div>
                  <p className="text-xs font-medium">{roleLabel[form.role] ?? form.role}</p>
                  <p className="text-xs text-muted-foreground">Avatar auto-assigned based on role</p>
                </div>
              </div>
            )}

            {/* Salutation + Full Name */}
            <div className="space-y-1">
              <Label>Name <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <Select value={form.salutation} onValueChange={(v) => setForm((f) => ({ ...f, salutation: v }))}>
                  <SelectTrigger className="w-28 shrink-0"><SelectValue placeholder="Title" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {SALUTATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="flex-1" placeholder="Full name" value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input type="email" placeholder="user@sankaraeye.com" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label>Employee ID <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. SAV-001" value={form.employeeId}
                onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label>Designation <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. Senior Ophthalmologist" value={form.designation}
                onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label>Gender <span className="text-red-500">*</span></Label>
              <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other / Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Role <span className="text-red-500">*</span></Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{availableRoles.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Unit <span className="text-red-500">*</span></Label>
              <Select value={form.unitId} onValueChange={(v) => setForm((f) => ({ ...f, unitId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>{units.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name} — {u.city}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button disabled={!isFormValid || addMutation.isPending} onClick={() => addMutation.mutate(form)}>
              {addMutation.isPending ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      {editUser && (
        <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              {/* Avatar preview */}
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <RoleAvatar role={editUser.role} size="md" showRing />
                <div>
                  <p className="text-xs font-medium">{roleLabel[editUser.role] ?? editUser.role}</p>
                  <p className="text-xs text-muted-foreground">Avatar reflects the assigned role</p>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1">
                <Label>Name</Label>
                <div className="flex gap-2">
                  <Select value={editUser.salutation ?? "none"} onValueChange={(v) => setEditUser((u) => u ? { ...u, salutation: v === "none" ? null : v } : u)}>
                    <SelectTrigger className="w-28 shrink-0"><SelectValue placeholder="Title" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {SALUTATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="flex-1" value={editUser.fullName}
                    onChange={(e) => setEditUser((u) => u ? { ...u, fullName: e.target.value } : u)} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={editUser.email}
                  onChange={(e) => setEditUser((u) => u ? { ...u, email: e.target.value } : u)} />
              </div>

              <div className="space-y-1">
                <Label>Employee ID <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. SAV-001" value={editUser.employeeId ?? ""}
                  onChange={(e) => setEditUser((u) => u ? { ...u, employeeId: e.target.value || null } : u)} />
              </div>

              <div className="space-y-1">
                <Label>Designation <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. Senior Ophthalmologist" value={editUser.designation ?? ""}
                  onChange={(e) => setEditUser((u) => u ? { ...u, designation: e.target.value || null } : u)} />
              </div>

              <div className="space-y-1">
                <Label>Gender</Label>
                <Select value={editUser.gender ?? ""} onValueChange={(v) => setEditUser((u) => u ? { ...u, gender: v } : u)}>
                  <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other / Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editUser.role !== "super_admin" && (
                <div className="space-y-1">
                  <Label>Role</Label>
                  <Select value={editUser.role} onValueChange={(v) => setEditUser((u) => u ? { ...u, role: v } : u)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{availableRoles.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <Label>Unit <span className="text-red-500">*</span></Label>
                <Select value={editUser.unitId ? String(editUser.unitId) : ""} onValueChange={(v) => setEditUser((u) => u ? { ...u, unitId: Number(v) } : u)}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>{units.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name} — {u.city}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={editUser.active ? "active" : "disabled"} onValueChange={(v) => setEditUser((u) => u ? { ...u, active: v === "active" } : u)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button
                disabled={!editUser.fullName || !editUser.email || !editUser.employeeId || !editUser.designation || !editUser.unitId || editMutation.isPending}
                onClick={() => editMutation.mutate({
                  id: editUser.id,
                  data: {
                    email: editUser.email,
                    fullName: editUser.fullName,
                    salutation: editUser.salutation,
                    employeeId: editUser.employeeId,
                    designation: editUser.designation,
                    gender: editUser.gender,
                    avatarSeed: editUser.avatarSeed,
                    role: editUser.role,
                    unitId: editUser.unitId,
                    active: editUser.active,
                  },
                })}>
                {editMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete User Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete User</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{deleteUser ? displayName(deleteUser) : ""}</strong>? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}>
              {deleteMutation.isPending ? "Deleting…" : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={() => setResetUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reset Password — {resetUser ? displayName(resetUser) : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Set a new temporary password. The user will be required to change it on next login.</p>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="Min 8 characters" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>Cancel</Button>
            <Button
              disabled={!resetPw || resetPw.length < 8 || resetMutation.isPending}
              onClick={() => resetUser && resetMutation.mutate({ userId: resetUser.id, newPassword: resetPw })}
            >
              {resetMutation.isPending ? "Resetting…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
