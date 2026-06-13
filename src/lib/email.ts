/// <reference types="@cloudflare/workers-types" />

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  env: { RESEND_API_KEY?: string; FROM_EMAIL?: string };
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const apiKey = args.env.RESEND_API_KEY?.trim();
  const fromEmail = args.env.FROM_EMAIL?.trim();
  if (!apiKey || !fromEmail) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        ...(args.text ? { text: args.text } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend error", res.status, body.slice(0, 300));
    }
  } catch (err) {
    console.error("Resend send failed", err);
  }
}
