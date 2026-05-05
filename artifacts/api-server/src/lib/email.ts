import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env["SMTP_HOST"];
  const port = Number(process.env["SMTP_PORT"] ?? "587");
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  const from = process.env["SMTP_FROM"] ?? "noreply@sankaraeye.com";

  if (!host || !user || !pass) return null;

  return { transporter: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }), from };
}

export async function sendApplicationApprovalEmail(opts: {
  toEmail: string; toName: string; candidateCode: string; programName: string; formTitle: string;
}) {
  const cfg = getTransporter();
  if (!cfg) {
    console.warn("[email] SMTP not configured — skipping approval email to", opts.toEmail);
    return;
  }
  await cfg.transporter.sendMail({
    from: `"Sankara Academy of Vision" <${cfg.from}>`,
    to: opts.toEmail,
    subject: `Application Approved — ${opts.programName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
        <img src="cid:logo" alt="Sankara Academy" style="height:50px;margin-bottom:16px" />
        <h2 style="color:#1d4ed8;margin:0 0 8px">Application Approved</h2>
        <p style="color:#374151">Dear <strong>${opts.toName}</strong>,</p>
        <p style="color:#374151">
          We are pleased to inform you that your application for the
          <strong>${opts.programName}</strong> fellowship has been reviewed and <strong>approved</strong>.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;margin:20px 0">
          <p style="margin:0;font-size:14px;color:#166534">
            <strong>Your Candidate Code:</strong>&nbsp;
            <span style="font-family:monospace;font-size:16px;font-weight:bold">${opts.candidateCode}</span>
          </p>
          <p style="margin:6px 0 0;font-size:13px;color:#166534">
            Please keep this code safe — you will need it for the examination and interview process.
          </p>
        </div>
        <p style="color:#374151;font-size:14px">
          Further details regarding the examination schedule will be communicated to you shortly.
          Please ensure you are reachable on the email and phone number provided in your application.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#9ca3af;font-size:12px;margin:0">
          Sankara Academy of Vision &bull; Sankara Eye Care Institutions &bull; This is an automated message, please do not reply.
        </p>
      </div>
    `,
  });
}

export async function sendStatusUpdateEmail(opts: {
  toEmail: string; toName: string; status: string; programName?: string;
}) {
  const cfg = getTransporter();
  if (!cfg) return;

  const subjectMap: Record<string, string> = {
    rejected: "Application Status Update",
    interview_completed: "Interview Completed — Thank You",
    allocated: "Congratulations — Fellowship Seat Allocated",
  };

  const bodyMap: Record<string, string> = {
    rejected: `We regret to inform you that after careful review, your application could not be accepted at this time. We wish you the very best in your future endeavours.`,
    interview_completed: `Thank you for appearing for the interview. Your results will be communicated shortly.`,
    allocated: `Congratulations! You have been allocated a fellowship seat. Please report as per the schedule that will be sent to you.`,
  };

  const subject = subjectMap[opts.status];
  const body = bodyMap[opts.status];
  if (!subject || !body) return;

  await cfg.transporter.sendMail({
    from: `"Sankara Academy of Vision" <${cfg.from}>`,
    to: opts.toEmail,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#1d4ed8;margin:0 0 8px">${subject}</h2>
        <p style="color:#374151">Dear <strong>${opts.toName}</strong>,</p>
        <p style="color:#374151">${body}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#9ca3af;font-size:12px;margin:0">Sankara Academy of Vision &bull; This is an automated message.</p>
      </div>
    `,
  });
}
