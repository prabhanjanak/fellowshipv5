import { useState } from "react";
import logoUrl from "@assets/seh_sav_logo_1777703794142.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Eye, EyeOff, HelpCircle, PhoneCall } from "lucide-react";
import ParticleCanvas from "@/components/ParticleCanvas";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-[#0b1f3a] via-[#112d54] to-[#0b1f3a]">
      <ParticleCanvas count={80} color="255, 122, 0" connectionColor="255, 159, 67" maxDistance={140} />

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <img src={logoUrl} alt="Sankara Eye Foundation" className="h-20 w-auto mx-auto rounded-xl shadow-lg object-contain bg-white p-2" />
          <div>
            <h1 className="text-2xl font-bold text-white drop-shadow">Sankara Academy of Vision</h1>
            <p className="text-sm text-blue-200 mt-1">Fellowship Exam Management System</p>
          </div>
        </div>

        <Card className="border-0 shadow-2xl backdrop-blur-sm bg-card/90">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold text-center text-foreground">Sign In</h2>
            <p className="text-xs text-center text-muted-foreground">Only @sankaraeye.com accounts are permitted</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@sankaraeye.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="pr-10" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : "Sign In"}
              </Button>
              <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 pt-1" onClick={() => setForgotOpen(true)}>
                <HelpCircle className="h-3.5 w-3.5" /> Forgot password?
              </button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-blue-300">
          Sankara Eye Foundation — Sri Kanchi Kamakoti Medical Trust
        </p>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-primary" /> Forgot Password?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>Password resets can only be done by your system administrator.</p>
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 space-y-1 text-orange-900">
              <p className="font-semibold text-sm">Contact your Administrator</p>
              <p className="text-xs">Email: <a href="mailto:admin@sankaraeye.com" className="underline">admin@sankaraeye.com</a></p>
              <p className="text-xs">Please provide your registered email address to receive a temporary password.</p>
            </div>
            <p className="text-xs">New users: your initial password is <code className="bg-muted px-1 rounded font-mono">Welcome@123</code></p>
          </div>
          <Button className="w-full mt-2" onClick={() => setForgotOpen(false)}>Close</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
