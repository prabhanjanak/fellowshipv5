import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Zap, Download, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Program { id: number; name: string; }
interface Allocation {
  id: number;
  candidateId: number;
  candidateCode: string;
  candidateName: string;
  programId: number;
  specialityName: string | null;
  unitName: string | null;
  status: string;
  rank: number | null;
  totalScore: number | null;
}

interface SeatMatrixRow {
  speciality: string;
  seats: Record<string, { total: number; allocated: number }>;
  total: number;
  totalAllocated: number;
}

interface SeatMatrix { rows: SeatMatrixRow[]; units: string[]; }

const statusColors: Record<string, string> = {
  SELECTED: "bg-green-100 text-green-800",
  WAITLISTED: "bg-yellow-100 text-yellow-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function AllocationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedProgram, setSelectedProgram] = useState<string>("");

  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ["programs"],
    queryFn: () => api.get<Program[]>("/programs"),
  });

  // Auto-select first program
  useEffect(() => {
    if (programs.length > 0 && !selectedProgram) {
      setSelectedProgram(String(programs[0]!.id));
    }
  }, [programs, selectedProgram]);

  const { data: allocations = [], isLoading } = useQuery<Allocation[]>({
    queryKey: ["allocations", selectedProgram],
    queryFn: () => api.get<Allocation[]>(`/allocations${selectedProgram ? `?programId=${selectedProgram}` : ""}`),
    enabled: !!selectedProgram,
  });

  const { data: matrix } = useQuery<SeatMatrix>({
    queryKey: ["seat-matrix", selectedProgram ? Number(selectedProgram) : null],
    queryFn: () => api.get<SeatMatrix>(`/seat-matrix?programId=${selectedProgram}`),
    enabled: !!selectedProgram,
  });

  const runAllocation = useMutation({
    mutationFn: (programId: number) => api.post<{ allocated: number }>(`/allocations/run`, { programId }),
    onSuccess: (data) => {
      toast({ title: `Allocation complete — ${data.allocated} candidates allocated` });
      qc.invalidateQueries({ queryKey: ["allocations"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const downloadLetter = async (allocationId: number) => {
    try {
      const token = localStorage.getItem("fellowship_token");
      const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/allocations/${allocationId}/letter`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `allocation-letter-${allocationId}.pdf`; a.click();
    } catch {
      toast({ title: "Error downloading letter", variant: "destructive" });
    }
  };

  const selectedProgramName = programs.find((p) => String(p.id) === selectedProgram)?.name ?? "";

  // Seat summary from matrix
  const totalSeats = matrix?.rows.reduce((s, r) => s + r.total, 0) ?? 0;
  const totalAllocated = matrix?.rows.reduce((s, r) => s + r.totalAllocated, 0) ?? 0;
  const totalRemaining = totalSeats - totalAllocated;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="h-6 w-6" /> Allocations</h1>
          <p className="text-muted-foreground text-sm mt-1">Fellowship seat allocations</p>
        </div>
        {selectedProgram && (
          <Button
            className="gap-2" variant="outline"
            onClick={() => runAllocation.mutate(Number(selectedProgram))}
            disabled={runAllocation.isPending}
          >
            <Zap className="h-4 w-4" />
            {runAllocation.isPending ? "Running…" : "Run Allocation"}
          </Button>
        )}
      </div>

      {/* Program tabs */}
      {programs.length > 1 && (
        <div className="flex gap-1.5 flex-wrap border-b pb-3">
          {programs.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProgram(String(p.id))}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedProgram === String(p.id)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Seat availability summary */}
      {matrix && totalSeats > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Seats", value: totalSeats, cls: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" },
            { label: "Allocated", value: totalAllocated, cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300" },
            { label: "Remaining", value: totalRemaining, cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" },
            { label: "Allocations Run", value: allocations.length, cls: "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300" },
          ].map(({ label, value, cls }) => (
            <Card key={label} className={`border-0 ${cls}`}>
              <CardContent className="py-3 px-4">
                <p className="text-xs font-medium opacity-75">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Seat matrix by speciality */}
      {matrix && matrix.rows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Seat Availability — {selectedProgramName}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Speciality</th>
                    {matrix.units.map((u) => (
                      <th key={u} className="px-3 py-2.5 font-medium text-muted-foreground text-center">{u}</th>
                    ))}
                    <th className="px-3 py-2.5 font-medium text-muted-foreground text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((row, ri) => (
                    <tr key={row.speciality} className={`border-b last:border-0 ${ri % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                      <td className="px-4 py-2 font-medium">{row.speciality}</td>
                      {matrix.units.map((u) => {
                        const cell = row.seats[u] ?? { total: 0, allocated: 0 };
                        const pct = cell.total > 0 ? cell.allocated / cell.total : 0;
                        const color = pct >= 1 ? "text-red-600" : pct > 0.5 ? "text-amber-600" : "text-emerald-600";
                        return (
                          <td key={u} className="px-3 py-2 text-center">
                            {cell.total > 0 ? (
                              <span className={`font-mono font-semibold ${color}`}>{cell.allocated}/{cell.total}</span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center font-bold text-primary">
                        {row.totalAllocated}/{row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Allocations table */}
      {!selectedProgram ? (
        <div className="text-center py-12">
          <Award className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No programs found</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : allocations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No allocations yet for {selectedProgramName}</p>
            <Button onClick={() => runAllocation.mutate(Number(selectedProgram))} disabled={runAllocation.isPending} className="gap-2">
              <Zap className="h-4 w-4" />
              {runAllocation.isPending ? "Running…" : "Run Allocation Now"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{allocations.length} allocations — {selectedProgramName}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rank</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Candidate</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Speciality</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unit</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Score</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Letter</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-bold text-muted-foreground">#{a.rank ?? "—"}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{a.candidateName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{a.candidateCode}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.specialityName ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.unitName ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold">{a.totalScore?.toFixed(1) ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge className={statusColors[a.status] ?? ""} variant="secondary">{a.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => downloadLetter(a.id)}>
                          <Download className="h-3.5 w-3.5" />
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
    </div>
  );
}
