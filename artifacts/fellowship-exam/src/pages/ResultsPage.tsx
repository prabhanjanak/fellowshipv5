import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle2, Clock } from "lucide-react";

interface AttemptResult {
  id: number;
  examId: number;
  examTitle: string;
  examKind: string;
  score: number | null;
  maxScore: number | null;
  submittedAt: string | null;
  startedAt: string;
}

interface Allocation {
  id: number;
  specialityName: string | null;
  unitName: string | null;
  status: string;
  rank: number | null;
  totalScore: number | null;
}

export default function ResultsPage() {
  const { data: attempts = [] } = useQuery<AttemptResult[]>({
    queryKey: ["my-attempts"],
    queryFn: () => api.get<AttemptResult[]>("/attempts/me"),
  });

  const { data: allocation } = useQuery<Allocation | null>({
    queryKey: ["my-allocation"],
    queryFn: () => api.get<Allocation | null>("/allocations/me").catch(() => null),
  });

  const statusColors: Record<string, string> = {
    SELECTED: "bg-green-100 text-green-800",
    WAITLISTED: "bg-yellow-100 text-yellow-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Results</h1>
        <p className="text-muted-foreground text-sm mt-1">Exam results and allocation status</p>
      </div>

      {allocation && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">Allocation Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{allocation.specialityName ?? "Pending allocation"}</p>
                {allocation.unitName && <p className="text-sm text-muted-foreground">{allocation.unitName}</p>}
                {allocation.rank != null && <p className="text-xs text-muted-foreground mt-1">Rank: #{allocation.rank}</p>}
              </div>
              {allocation.status && (
                <Badge className={statusColors[allocation.status] ?? ""} variant="secondary">
                  {allocation.status}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Exam Attempts</h2>
        {attempts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No exam attempts yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {attempts.map((a) => {
              const pct = a.score != null && a.maxScore ? Math.round((a.score / a.maxScore) * 100) : null;
              return (
                <Card key={a.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">{a.examTitle}</p>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">{a.examKind}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Started: {new Date(a.startedAt).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="text-right">
                        {a.submittedAt ? (
                          <>
                            <div className="flex items-center gap-1.5 justify-end text-green-600 text-xs font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                            </div>
                            {a.score != null && (
                              <p className="text-lg font-bold mt-1">{a.score}/{a.maxScore ?? "?"}</p>
                            )}
                            {pct != null && (
                              <p className="text-xs text-muted-foreground">{pct}%</p>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium">
                            <Clock className="h-3.5 w-3.5" /> In Progress
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
