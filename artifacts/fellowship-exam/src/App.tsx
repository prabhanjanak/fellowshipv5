import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AppSidebar from "@/components/AppSidebar";
import { PageTransition } from "@/components/PageTransition";
import LoginPage from "@/pages/LoginPage";
import ForcePasswordResetPage from "@/pages/ForcePasswordResetPage";
import DashboardPage from "@/pages/DashboardPage";
import CandidatesPage from "@/pages/CandidatesPage";
import ExamsPage from "@/pages/ExamsPage";
import ProgramsPage from "@/pages/ProgramsPage";
import UsersPage from "@/pages/UsersPage";
import InterviewsPage from "@/pages/InterviewsPage";
import RankingsPage from "@/pages/RankingsPage";
import AllocationsPage from "@/pages/AllocationsPage";
import ProfilePage from "@/pages/ProfilePage";
import ResultsPage from "@/pages/ResultsPage";
import ApplicationFormsPage from "@/pages/ApplicationFormsPage";
import UnitsPage from "@/pages/UnitsPage";
import SeatMatrixPage from "@/pages/SeatMatrixPage";
import PaymentsPage from "@/pages/PaymentsPage";
import ApplyPage from "@/pages/ApplyPage";
import DisplayPage from "@/pages/DisplayPage";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  if (user.forcePasswordReset) return <ForcePasswordResetPage />;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <PageTransition>
          <Switch>
            <Route path="/" component={DashboardPage} />
            <Route path="/programs" component={ProgramsPage} />
            <Route path="/users" component={UsersPage} />
            <Route path="/candidates" component={CandidatesPage} />
            <Route path="/exams" component={ExamsPage} />
            <Route path="/interviews" component={InterviewsPage} />
            <Route path="/rankings" component={RankingsPage} />
            <Route path="/allocations" component={AllocationsPage} />
            <Route path="/application-forms" component={ApplicationFormsPage} />
            <Route path="/units" component={UnitsPage} />
            <Route path="/seat-matrix" component={SeatMatrixPage} />
            <Route path="/payments" component={PaymentsPage} />
            <Route path="/profile" component={ProfilePage} />
            <Route path="/results" component={ResultsPage} />
            <Route path="/display" component={DisplayPage} />
            <Route component={NotFound} />
          </Switch>
        </PageTransition>
      </main>
    </div>
  );
}

function App() {
  // Public apply route — render outside auth entirely
  // pathname may be /apply/TOKEN or /admin/apply/TOKEN depending on base
  const applyMatch = window.location.pathname.match(/\/apply\/([^/?#]+)/);
  if (applyMatch) {
    const token = applyMatch[1]!;
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeProvider>
            <ApplyPage token={token} />
            <Toaster />
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRouter />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
