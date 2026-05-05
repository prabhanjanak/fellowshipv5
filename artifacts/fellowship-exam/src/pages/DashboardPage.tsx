import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, BookOpen, Award, ClipboardList, Clock, Building2 } from "lucide-react";

interface DashboardStats {
  candidates: number;
  programs: number;
  units: number;
  activeExams: number;
  allocated: number;
  pendingReview: number;
}

function StatCard({
  title, value, icon: Icon, color, href,
}: {
  title: string; value: number | string; icon: React.ElementType; color: string; href?: string;
}) {
  const [, navigate] = useLocation();
  return (
    <Card
      onClick={() => href && navigate(href)}
      className={href ? "cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0" : ""}
    >
      <CardContent className="flex items-center gap-4 pt-6">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  interview_completed: "bg-blue-100 text-blue-800",
  waitlisted: "bg-purple-100 text-purple-800",
  allocated: "bg-emerald-100 text-emerald-800",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role ?? "";

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardStats>("/dashboard/summary"),
    retry: false,
  });

  const { data: candidates } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => api.get<{ id: number; fullName: string; status: string; candidateCode: string }[]>("/candidates"),
    enabled: !["student"].includes(role),
    retry: false,
  });

  if (role === "student") {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {user?.fullName}</h1>
          <p className="text-muted-foreground mt-1">Fellowship Candidate Portal</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Assigned Exams" value="—" icon={BookOpen} color="bg-orange-500" href="/exams" />
          <StatCard title="Completed Exams" value="—" icon={ClipboardList} color="bg-blue-600" href="/results" />
          <StatCard title="Allocation Status" value="Pending" icon={Award} color="bg-emerald-600" />
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Getting Started</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Complete your candidate profile under <strong>My Profile</strong></p>
            <p>2. Take assigned entrance exams under <strong>Exams</strong></p>
            <p>3. Check your results under <strong>My Results</strong></p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canSeeCandidates = ["super_admin","program_admin","central_exam_coordinator","unit_coordinator"].includes(role);
  const canSeeExams      = ["super_admin","program_admin","central_exam_coordinator"].includes(role);
  const canSeeAllocations= ["super_admin","program_admin"].includes(role);
  const canSeePrograms   = ["super_admin","program_admin"].includes(role);

  const gridCards = [
    { title: "Total Candidates", value: stats?.candidates ?? "—", icon: Users, color: "bg-orange-500", href: canSeeCandidates ? "/candidates" : undefined },
    { title: "Active Exams", value: stats?.activeExams ?? "—", icon: BookOpen, color: "bg-blue-600", href: canSeeExams ? "/exams" : undefined },
    { title: "Programs", value: stats?.programs ?? "—", icon: ClipboardList, color: "bg-purple-600", href: canSeePrograms ? "/programs" : undefined },
    { title: "Allocations", value: stats?.allocated ?? "—", icon: Award, color: "bg-emerald-600", href: canSeeAllocations ? "/allocations" : undefined },
    { title: "Units", value: stats?.units ?? "—", icon: Building2, color: "bg-indigo-600", href: undefined },
    { title: "Pending Review", value: stats?.pendingReview ?? "—", icon: Clock, color: "bg-amber-600", href: canSeeCandidates ? "/candidates" : undefined },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {role === "unit_coordinator" ? `Unit Overview — ${user?.fullName}` : "Fellowship Exam Management Overview"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gridCards.map((c) => (
          <StatCard key={c.title} title={c.title} value={c.value} icon={c.icon} color={c.color} href={c.href} />
        ))}
      </div>

      {candidates && candidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Candidates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {candidates.slice(0, 8).map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{c.fullName}</p>
                    <p className="text-xs text-muted-foreground">{c.candidateCode}</p>
                  </div>
                  <Badge className={statusColors[c.status] ?? "bg-gray-100 text-gray-800"} variant="secondary">
                    {c.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
