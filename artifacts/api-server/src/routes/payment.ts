import { Router } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, paymentSettingsTable, applicationFormsTable } from "@workspace/db";
import Razorpay from "razorpay";

const router: Router = Router();

// POST /api/payment/create-order
router.post("/payment/create-order", async (req, res) => {
  try {
    const { token } = req.body as { token: string };
    if (!token) return res.status(400).json({ error: "Token is required" });

    // 1. Find the form to get the programId
    const [form] = await db.select().from(applicationFormsTable).where(eq(applicationFormsTable.token, token));
    if (!form) return res.status(404).json({ error: "Form not found" });

    const programId = form.programId;

    // 2. Fetch active payment settings
    const all = await db.select().from(paymentSettingsTable).where(eq(paymentSettingsTable.isActive, true));
    const specific = programId ? all.find((s) => s.programId === programId) : null;
    const global = all.find((s) => s.programId === null);
    const setting = specific ?? global;

    if (!setting || !setting.razorpayKeyId || !setting.razorpayKeySecret) {
      return res.status(400).json({ error: "Razorpay is not configured for this program" });
    }

    // 3. Initialize Razorpay instance as per official guide
    const instance = new Razorpay({
      key_id: setting.razorpayKeyId,
      key_secret: setting.razorpayKeySecret,
    });

    // 4. Create order using SDK
    const options = {
      amount: Number(setting.amount), // amount is already in paise (smallest unit) in DB
      currency: setting.currency || "INR",
      receipt: `receipt_form_${form.id}_${Date.now()}`,
    };

    const order = await instance.orders.create(options);

    // Return order and public key to frontend
    res.json({
      order,
      key: setting.razorpayKeyId, // Include key for the frontend checkout modal
      mode: setting.mode
    });
  } catch (error: any) {
    console.error("Order creation failed:", error);
    res.status(500).json({ error: error.message || "Failed to create order" });
  }
});

// POST /api/payment/verify
router.post("/payment/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, token } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });

    // 1. Find the form to get the programId
    const [form] = await db.select().from(applicationFormsTable).where(eq(applicationFormsTable.token, token));
    if (!form) return res.status(404).json({ error: "Form not found" });

    const programId = form.programId;

    // 2. Fetch active payment settings
    const all = await db.select().from(paymentSettingsTable).where(eq(paymentSettingsTable.isActive, true));
    const specific = programId ? all.find((s) => s.programId === programId) : null;
    const global = all.find((s) => s.programId === null);
    const setting = specific ?? global;

    if (!setting || !setting.razorpayKeySecret) {
      return res.status(400).json({ error: "Razorpay secret not found" });
    }

    // 3. Verify signature using standard HMAC logic (as shown in Razorpay docs)
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", setting.razorpayKeySecret)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      return res.json({ success: true, status: "ok" });
    }

    res.status(400).json({ success: false, error: "Invalid signature" });
  } catch (error: any) {
    console.error("Verification failed:", error);
    res.status(500).json({ error: error.message || "Verification failed" });
  }
});

export default router;
