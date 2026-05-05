import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  CreditCard, Plus, Pencil, Trash2, Building2, Eye, EyeOff, Copy, Check,
  IndianRupee, Zap, AlertCircle, CheckCircle2, Smartphone,
} from "lucide-react";
import QRCode from "react-qr-code";
import { useToast } from "@/hooks/use-toast";

interface Program { id: number; name: string; }
interface PaymentSetting {
  id: number;
  programId: number | null;
  programName: string | null;
  razorpayKeyId: string | null;
  razorpayKeySecret: string | null;
  upiId: string | null;
  amount: number;
  amountRs: number;
  currency: string;
  description: string;
  mode: string;
  isActive: boolean;
}

const BLANK: Omit<PaymentSetting, "id" | "programName" | "amount"> = {
  programId: null,
  razorpayKeyId: "",
  razorpayKeySecret: "",
  upiId: "",
  amountRs: 2750,
  currency: "INR",
  description: "Fellowship Application Fee",
  mode: "test",
  isActive: true,
};

function buildUpiUrl(upiId: string, amount: number, name: string, note: string) {
  const params = new URLSearchParams({ pa: upiId, pn: name, am: String(amount), cu: "INR", tn: note });
  return `upi://pay?${params.toString()}`;
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<PaymentSetting | null>(null);
  const [form, setForm] = useState({ ...BLANK, programId: null as number | null });
  const [showSecret, setShowSecret] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const canEdit = user?.role === "super_admin" || user?.role === "program_admin";

  const { data: settings = [] } = useQuery<PaymentSetting[]>({
    queryKey: ["payment-settings"],
    queryFn: () => api.get<PaymentSetting[]>("/payment-settings"),
  });

  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ["programs"],
    queryFn: () => api.get<Program[]>("/programs"),
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) =>
      editItem
        ? api.patch(`/payment-settings/${editItem.id}`, data)
        : api.post("/payment-settings", data),
    onSuccess: () => {
      toast({ title: editItem ? "Payment settings updated" : "Payment settings created" });
      qc.invalidateQueries({ queryKey: ["payment-settings"] });
      setDialogOpen(false);
      setEditItem(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/payment-settings/${id}`),
    onSuccess: () => {
      toast({ title: "Configuration deleted" });
      qc.invalidateQueries({ queryKey: ["payment-settings"] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...BLANK, programId: null });
    setShowSecret(false);
    setDialogOpen(true);
  };

  const openEdit = (s: PaymentSetting) => {
    setEditItem(s);
    setForm({
      programId: s.programId,
      razorpayKeyId: s.razorpayKeyId ?? "",
      razorpayKeySecret: s.razorpayKeySecret ?? "",
      upiId: s.upiId ?? "",
      amountRs: s.amountRs,
      currency: s.currency,
      description: s.description,
      mode: s.mode,
      isActive: s.isActive,
    });
    setShowSecret(false);
    setDialogOpen(true);
  };

  const copyKey = (id: number, key: string) => {
    navigator.clipboard.writeText(key).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const toggleActive = (s: PaymentSetting) => {
    api.patch(`/payment-settings/${s.id}`, { isActive: !s.isActive })
      .then(() => qc.invalidateQueries({ queryKey: ["payment-settings"] }))
      .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  };

  useEffect(() => {
    if (!dialogOpen) setShowSecret(false);
  }, [dialogOpen]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configure Razorpay integration and fee settings</p>
        </div>
        {canEdit && (
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Configuration
          </Button>
        )}
      </div>

      {/* Bank Transfer Details */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" /> Bank Transfer Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              ["Account Name", "Sankara Academy of Vision"],
              ["Account Number", "50100004642084"],
              ["Bank & Branch", "HDFC Bank, Saravanampatti Branch, Coimbatore"],
              ["IFSC Code", "HDFC0002231"],
              ["Accepted Modes", "Google Pay · PhonePe · Paytm · RTGS · NEFT"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <p className="font-semibold mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-3 bg-blue-100 dark:bg-blue-900/40 rounded p-2">
            Candidates must upload the payment screenshot in the application form as proof of payment.
          </p>
        </CardContent>
      </Card>

      {/* Razorpay Configurations */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Razorpay Configurations</h2>

        {settings.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No Razorpay configuration yet.</p>
              {canEdit && (
                <Button variant="outline" className="mt-3 gap-2" onClick={openAdd}>
                  <Plus className="h-4 w-4" /> Add Configuration
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {settings.map((s) => {
              const hasCreds = !!(s.razorpayKeyId && s.razorpayKeySecret);
              return (
                <Card key={s.id} className={!s.isActive ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-sm">
                            {s.programName ? s.programName : "All Programs (Global)"}
                          </p>
                          <Badge variant="outline" className={s.mode === "live" ? "border-green-300 text-green-700" : "border-amber-300 text-amber-700"}>
                            {s.mode === "live" ? "Live" : "Test"}
                          </Badge>
                          {s.isActive ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                          )}
                          {!hasCreds && (
                            <Badge variant="outline" className="border-orange-300 text-orange-700 gap-1">
                              <AlertCircle className="h-3 w-3" /> No Keys — Mock Mode
                            </Badge>
                          )}
                          {hasCreds && (
                            <Badge variant="outline" className="border-blue-300 text-blue-700 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Razorpay Connected
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <div className="flex items-center gap-1 text-lg font-bold text-primary">
                            <IndianRupee className="h-4 w-4" />
                            {s.amountRs.toLocaleString("en-IN")}
                          </div>
                          {s.razorpayKeyId && (
                            <div className="flex items-center gap-1">
                              <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {s.razorpayKeyId}
                              </code>
                              <Button
                                variant="ghost" size="sm" className="h-6 w-6 p-0"
                                onClick={() => copyKey(s.id, s.razorpayKeyId!)}
                              >
                                {copiedId === s.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                          )}
                          {s.upiId && (
                            <Badge variant="outline" className="border-green-300 text-green-700 gap-1 text-xs">
                              <Smartphone className="h-3 w-3" /> UPI: {s.upiId}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {canEdit && (
                          <Switch checked={s.isActive} onCheckedChange={() => toggleActive(s)} />
                        )}
                        {canEdit && (
                          <Button variant="outline" size="sm" className="gap-1 h-8" onClick={() => openEdit(s)}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteId(s.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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

      {/* Important Notices (for reference) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" /> Important Notices Shown on Application Form
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
            <li>More than one sub specialty candidates are requested to fill up the application form again with the required application fees.</li>
            <li>Kindly carry your basic and post-graduate educational certificates, current valid medical registration license, and passport-size photograph.</li>
            <li>Selection process involves a written test (MCQ pattern) and an interview.</li>
            <li>Application fee of Rs.2750/- can be paid only through online transfer to the HDFC Bank account detailed above.</li>
            <li>The age limit is 35 years; those beyond 35 years and those awaiting PG results are not eligible to apply.</li>
            <li>Applicants under Government bond or Compulsory Rural Service must submit a 'No Objection Certificate' during the time of examination.</li>
            <li>All selected fellows must submit NOC from their State Medical Council during Fellowship induction — mandatory for joining.</li>
            <li>Two Letters of Recommendation are required to be uploaded in the last page of the Application form.</li>
            <li>The receipt of online payment (screenshot) should be enclosed to the application form at the option enabled.</li>
          </ol>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditItem(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              {editItem ? "Edit Payment Configuration" : "Add Payment Configuration"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Applies To</Label>
              <Select
                value={form.programId != null ? String(form.programId) : "all"}
                onValueChange={(v) => setForm((f) => ({ ...f, programId: v === "all" ? null : Number(v) }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs (Global)</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={form.amountRs}
                  onChange={(e) => setForm((f) => ({ ...f, amountRs: Number(e.target.value) }))}
                  placeholder="2750"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Fellowship Application Fee"
              />
            </div>

            <div className="space-y-1.5">
              <Label>UPI ID</Label>
              <div className="relative">
                <Smartphone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={form.upiId ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, upiId: e.target.value }))}
                  placeholder="sankaraeye@hdfcbank"
                  className="pl-8 font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">Used to generate a scannable UPI QR code on the payment page</p>
              {form.upiId && (
                <div className="flex flex-col items-center gap-2 mt-2 p-3 bg-muted/30 rounded-lg border">
                  <p className="text-xs text-muted-foreground font-medium">QR Preview</p>
                  <div className="bg-white p-2 rounded">
                    <QRCode
                      value={buildUpiUrl(form.upiId, (form.amountRs ?? 2750), "Sankara Academy of Vision", "Fellowship Application Fee")}
                      size={120}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{form.upiId} · ₹{form.amountRs?.toLocaleString("en-IN")}</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Razorpay Key ID</Label>
              <Input
                value={form.razorpayKeyId ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, razorpayKeyId: e.target.value }))}
                placeholder="rzp_test_XXXXXXXXXXXX"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Razorpay Key Secret</Label>
              <div className="relative">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={form.razorpayKeySecret ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, razorpayKeySecret: e.target.value }))}
                  placeholder="••••••••••••••••••••••••"
                  className="font-mono text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-7 w-7 p-0"
                  onClick={() => setShowSecret((v) => !v)}
                >
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Leave blank to use simulation/mock mode</p>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                id="active-toggle"
              />
              <Label htmlFor="active-toggle">Active (shown on application form)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditItem(null); }}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              {saveMutation.isPending ? "Saving…" : "Save Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Configuration?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove the payment configuration. Application forms using this setting will fall back to simulation mode.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
