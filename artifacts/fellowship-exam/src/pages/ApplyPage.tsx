import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Step1 from "./apply-sections/Step1";
import Step2 from "./apply-sections/Step2";
import Step3 from "./apply-sections/Step3";

// Ensure Razorpay type exists
declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => { open(): void };
  }
}

const API = "/api";
const STEPS = ["Pre-requisites", "Experience", "Documents"];

const INITIAL_FORM = {
  fullName: "", email: "", phone: "", dateOfBirth: "", maritalStatus: "", spouseDetails: "",
  specialization: [] as string[],
  centerPreference: {} as Record<string, string[]>,
  referralSource: "", referredByName: "", mediaSource: "",
  permanentAddress: "", mailingAddress: "",
  medicalConditions: [] as string[],
  previousApplicationMonthYear: "", appearedEarlier: "No",
  degree: "", medicalCollege: "", university: "", pgQualification: "",
  qualificationMatrix: {} as Record<string, string>,
  doDetails: "", msMdDetails: "", dnbDetails: "",
  medicalCouncilNumber: "", otherCertifications: "",
  diagnosticSkills: {} as Record<string, string>,
  surgicalExperience: {} as Record<string, string>,
  publications: "", presentations: "",
  lor1RefName: "", lor1RefContact: "", lor1RefEmail: "",
  lor2RefName: "", lor2RefContact: "", lor2RefEmail: "",
  additionalInfo: "", declarationChecked: false,
};

export default function ApplyPage({ token }: { token: string }) {
  const [formInfo, setFormInfo] = useState<any>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // File states
  const [lor1File, setLor1File] = useState<File | null>(null);
  const [lor2File, setLor2File] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  
  const [lor1Error, setLor1Error] = useState<string>("");
  const [lor2Error, setLor2Error] = useState<string>("");
  const [photoError, setPhotoError] = useState<string>("");
  const [paymentError, setPaymentError] = useState<string>("");
  
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [razorpayPaymentId, setRazorpayPaymentId] = useState<string | undefined>(undefined);
  const [isPaying, setIsPaying] = useState(false);
  
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/apply/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b.error ?? "Form not found");
        }
        return r.json();
      })
      .then((data) => setFormInfo(data))
      .catch((e: Error) => setFormError(e.message))
      .finally(() => setLoading(false));

    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [token]);

  const set = (field: string, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateStep = () => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!form.specialization || form.specialization.length === 0) e["specialization"] = "Select at least one specialization";
      form.specialization.forEach(spec => {
        if (!form.centerPreference[spec] || form.centerPreference[spec].length === 0) {
          e[`centerPreference_${spec}`] = "Select at least one unit";
        }
      });
      if (!form.referralSource) e["referralSource"] = "Select a referral source";
      if (form.referralSource === "Referred by faculty/trainee" && !form.referredByName.trim()) e["referredByName"] = "Referral name is required";
      if (form.referralSource === "Social Media" && !form.mediaSource.trim()) e["mediaSource"] = "Platform name is required";
      
      if (!form.fullName.trim()) e["fullName"] = "Full name is required";
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e["email"] = "Valid email is required";
      if (!form.phone.trim() || !/^\+91\d{10}$/.test(form.phone)) e["phone"] = "Must start with +91 followed by 10 digits";
      if (!form.dateOfBirth.trim()) e["dateOfBirth"] = "Date of Birth is required";
      if (!form.maritalStatus.trim()) e["maritalStatus"] = "Marital status is required";
      if (form.maritalStatus === "Married" && !form.spouseDetails.trim()) e["spouseDetails"] = "Spouse details are required";
      if (!form.permanentAddress.trim()) e["permanentAddress"] = "Permanent address is required";
      if (!form.mailingAddress.trim()) e["mailingAddress"] = "Mailing address is required";
      
      if (form.appearedEarlier === "Yes" && !form.previousApplicationMonthYear.trim()) e["previousApplicationMonthYear"] = "Month & Year is required";
    }
    
    if (step === 1) {
      if (!form.medicalConditions || form.medicalConditions.length === 0) e["medicalConditions"] = "Select at least one option";
      if (!form.degree.trim()) e["degree"] = "Degree is required";
      if (!form.medicalCollege.trim()) e["medicalCollege"] = "Medical College is required";
      if (!form.university.trim()) e["university"] = "University is required";
      if (!form.pgQualification.trim()) e["pgQualification"] = "PG Qualification is required";
      if (!form.medicalCouncilNumber.trim()) e["medicalCouncilNumber"] = "Medical Council Number is required";
      
      // Qualifications
      if (!form.publications.trim()) e["publications"] = "Journal Publications required";
      if (!form.presentations.trim()) e["presentations"] = "Presentations required";
    }
    
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const uploadFileToStorage = useCallback(async (file: File): Promise<string> => {
    const urlRes = await fetch(`${API}/apply/${token}/request-upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type, candidateName: form.fullName }),
    });
    if (!urlRes.ok) throw new Error("Failed to get upload URL");
    const { uploadURL, objectPath } = await urlRes.json();
    const uploadRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!uploadRes.ok) throw new Error("Failed to upload file");
    return objectPath as string;
  }, [token]);

  const handleLorFile = async (file: File, which: "lor1" | "lor2") => {
    const setError = which === "lor1" ? setLor1Error : setLor2Error;
    const setFile = which === "lor1" ? setLor1File : setLor2File;
    setError("");
    if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") {
      setError("Only PDF files are accepted for LOR."); return;
    }
    if (file.size > 1 * 1024 * 1024) {
      setError("File must be under 1 MB."); return;
    }
    setFile(file);
    setErrors(prev => ({ ...prev, [`${which}File`]: "" }));
  };

  const handlePhotoFile = async (file: File) => {
    setPhotoError("");
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setPhotoError("Only JPG or PNG images are accepted."); return;
    }
    if (file.size > 1 * 1024 * 1024) {
      setPhotoError("Photo must be under 1 MB."); return;
    }
    setPhotoFile(file);
    setErrors(prev => ({ ...prev, photoFile: "" }));
  };

  const handlePaymentFile = async (file: File) => {
    setPaymentError("");
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setPaymentError("Only JPG or PNG images are accepted."); return;
    }
    if (file.size > 1 * 1024 * 1024) {
      setPaymentError("Image must be under 1 MB."); return;
    }
    setPaymentFile(file);
    setErrors(prev => ({ ...prev, paymentFile: "" }));
  };

  const validateFinalStep = () => {
    const e: Record<string, string> = {};
    if (!form.lor1RefName.trim()) e["lor1RefName"] = "Required";
    if (!form.lor1RefContact.trim()) e["lor1RefContact"] = "Required";
    if (!form.lor1RefEmail.trim()) e["lor1RefEmail"] = "Required";
    if (!lor1File) e["lor1File"] = "LOR 1 is required";
    
    if (!form.lor2RefName.trim()) e["lor2RefName"] = "Required";
    if (!form.lor2RefContact.trim()) e["lor2RefContact"] = "Required";
    if (!form.lor2RefEmail.trim()) e["lor2RefEmail"] = "Required";
    if (!lor2File) e["lor2File"] = "LOR 2 is required";

    if (!paymentFile) e["paymentFile"] = "Payment Proof is required";
    if (!photoFile) e["photoFile"] = "Passport Photo is required";
    if (!form.declarationChecked) e["declarationChecked"] = "Declaration is required";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitApplicationAfterPayment = async (saveAsDraft: boolean = false, razorpayPaymentId?: string) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      let lor1Url, lor2Url, photoUrl, paymentUrl;
      if (lor1File || lor2File || photoFile || paymentFile) setUploading(true);
      if (lor1File) lor1Url = await uploadFileToStorage(lor1File);
      if (lor2File) lor2Url = await uploadFileToStorage(lor2File);
      if (photoFile) photoUrl = await uploadFileToStorage(photoFile);
      if (paymentFile) paymentUrl = await uploadFileToStorage(paymentFile);
      setUploading(false);

      const payload = {
        ...form,
        specialization: JSON.stringify(form.specialization),
        centerPreference: JSON.stringify(form.centerPreference),
        medicalConditions: JSON.stringify(form.medicalConditions),
        diagnosticSkills: JSON.stringify(form.diagnosticSkills),
        surgicalExperience: JSON.stringify(form.surgicalExperience),
        qualificationMatrix: JSON.stringify(form.qualificationMatrix),
        lor1Url, lor2Url, photoUrl, paymentUrl,
        paymentId: razorpayPaymentId,
        saveAsDraft
      };

      const res = await fetch(`${API}/apply/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        if (res.status === 429) throw new Error("Duplicate submission detected. Please wait a minute before trying again.");
        throw new Error("Submission failed");
      }
      setSubmitted(true);
      window.scrollTo(0, 0);
    } catch (e: unknown) {
      setUploading(false);
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const initiatePayment = async () => {
    setIsPaying(true);
    setSubmitError(null);
    try {
      // 1. Create order
      const orderRes = await fetch(`${API}/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });

      if (!orderRes.ok) {
        const errorData = await orderRes.json();
        throw new Error(errorData.error || "Failed to create payment order");
      }

      const { order, key, mode } = await orderRes.json();

      // If mode is 'test' but no keys, or it's a mock mode, we skip
      if (mode === 'mock' || !key) {
        setPaymentVerified(true);
        setIsPaying(false);
        return;
      }

      // 3. Open Razorpay Checkout
      const options = {
        key: key,
        amount: order.amount,
        currency: order.currency,
        name: "Sankara Academy",
        description: "Fellowship Application Fee",
        order_id: order.id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch(`${API}/payment/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...response, token }),
            });

            if (!verifyRes.ok) {
              setSubmitError("Payment verification failed");
              setIsPaying(false);
              return;
            }

            setPaymentVerified(true);
            setRazorpayPaymentId(response.razorpay_payment_id);
            setIsPaying(false);
          } catch (err) {
            setSubmitError("Payment verification error");
            setIsPaying(false);
          }
        },
        prefill: {
          name: form.fullName,
          email: form.email,
          contact: form.phone.replace("+91", ""),
        },
        theme: { color: "#f97316" },
        modal: {
          ondismiss: function() {
            setIsPaying(false);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();

    } catch (err: any) {
      setSubmitError(err.message || "Payment initialization failed");
      setIsPaying(false);
    }
  };

  const handleSubmit = async (saveAsDraft: boolean = false) => {
    if (saveAsDraft) {
      await submitApplicationAfterPayment(true);
      return;
    }

    if (!validateFinalStep()) {
      setSubmitError("Please fill all required fields");
      return;
    }

    // Check if payment is already verified (e.g. from Step 3)
    if (paymentVerified) {
      await submitApplicationAfterPayment(false, razorpayPaymentId);
      return;
    }

    // If not verified, initiate it now
    await initiatePayment();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (formError) return <div className="min-h-screen flex items-center justify-center"><AlertCircle className="h-10 w-10 text-destructive mr-2" /> {formError}</div>;
  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-blue-50 dark:from-orange-950 dark:to-blue-950 p-4">
      <Card className="max-w-lg w-full text-center p-8">
        <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold">Application {form.declarationChecked ? "Submitted!" : "Saved as Draft"}</h2>
        <p className="text-muted-foreground mt-2">Thank you, {form.fullName}. You will receive a confirmation at {form.email}.</p>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 dark:from-orange-950 dark:to-blue-950">
      <div className="bg-white dark:bg-card border-b border-border shadow-sm p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-xl shrink-0">SAV</div>
          <div>
            <h1 className="font-bold text-xl text-primary dark:text-orange-400">Sankara Academy of Vision</h1>
            <h2 className="font-semibold text-lg text-primary/80 dark:text-blue-300">Sankara Eye Foundation</h2>
            <p className="text-sm text-muted-foreground">Fellowship Application Form - June 2026</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-300 p-4 rounded-lg text-sm mb-6 space-y-1">
          <p className="font-semibold">General Validation Rules:</p>
          <ul className="list-disc pl-5">
            <li>All fields marked (<span className="text-destructive">*</span>) are mandatory</li>
            <li>Mobile number must start with +91 followed by exactly 10 digits (e.g. +919876543210)</li>
            <li>File uploads: Max size 1MB. LOR must be PDF. Images must be JPG/PNG.</li>
          </ul>
        </div>

        <div className="flex gap-2 justify-center mb-8">
          {STEPS.map((s, i) => (
            <Badge key={s} variant={step >= i ? "default" : "outline"} className="px-4 py-1">{s}</Badge>
          ))}
        </div>

        {step === 0 && <Step1 form={form} set={set} err={(f: string) => errors[f] ? <p className="text-xs text-destructive mt-1">{errors[f]}</p> : null} formInfo={formInfo} />}
        {step === 1 && <Step2 form={form} set={set} err={(f: string) => errors[f] ? <p className="text-xs text-destructive mt-1">{errors[f]}</p> : null} />}
        {step === 2 && (
          <>
            <Step3 
              form={form} set={set} err={(f: string) => errors[f] ? <p className="text-xs text-destructive mt-1">{errors[f]}</p> : null} 
              lor1File={lor1File} setLor1File={setLor1File} lor1Error={lor1Error} handleLorFile={handleLorFile} 
              lor2File={lor2File} setLor2File={setLor2File} lor2Error={lor2Error} 
              photoFile={photoFile} setPhotoFile={setPhotoFile} photoError={photoError} handlePhotoFile={handlePhotoFile} 
              paymentFile={paymentFile} setPaymentFile={setPaymentFile} paymentError={paymentError} handlePaymentFile={handlePaymentFile}
              onInitiatePayment={initiatePayment}
              paymentVerified={paymentVerified}
              isPaying={isPaying}
            />
            <div className="mt-4">
              {submitError && <div className="text-destructive text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4"/> {submitError}</div>}
            </div>
          </>
        )}

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => { if(step > 0) setStep(step - 1); }} disabled={step === 0}><ChevronLeft className="w-4 h-4 mr-1"/> Back</Button>
          <div className="space-x-3">
            <Button variant="secondary" onClick={() => handleSubmit(true)} disabled={submitting}>Save as Draft</Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => { if (validateStep()) { setStep(step + 1); window.scrollTo(0,0); } }}>Next <ChevronRight className="w-4 h-4 ml-1"/></Button>
            ) : (
              <Button onClick={() => handleSubmit(false)} disabled={submitting || !form.declarationChecked}>
                {submitting || uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2"/> Submitting...</> : "Submit Application"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
