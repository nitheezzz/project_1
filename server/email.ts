import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";

export function assertEmailDeliveryConfigured() {
  if (!ENV.resendApiKey.trim() || !ENV.resendFromEmail.trim()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Email verification is not configured yet. Please contact the studywithfun owner.",
    });
  }
}

export async function sendVerificationEmail(
  to: string,
  code: string,
  purpose: "verification" | "password_reset" = "verification"
) {
  assertEmailDeliveryConfigured();
  const isPasswordReset = purpose === "password_reset";
  const subject = isPasswordReset
    ? "Your studywithfun password reset code"
    : "Your studywithfun verification code";
  const action = isPasswordReset ? "reset your password" : "verify your email";
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: ENV.resendFromEmail,
        to: [to],
        subject,
        text: `Use this code to ${action}: ${code}. It expires in 10 minutes. If you did not request it, you can ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;color:#242424"><p>Use this code to ${action}:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "We couldn’t send the verification email. Check the address and try again shortly.",
    });
  }

  if (!response.ok) {
    console.warn(`[Email] Verification delivery failed with status ${response.status}.`);
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "We couldn’t send the verification email. Check the address and try again shortly.",
    });
  }
}
