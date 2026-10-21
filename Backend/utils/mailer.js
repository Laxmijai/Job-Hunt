
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export const sendOtpEmail = async (to, otp) => {
  const senderEmail = process.env.EMAIL_USER;

  if (!process.env.BREVO_API_KEY || !senderEmail) {
    throw new Error("Brevo API key or sender email is missing");
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: "Job Hunt",
        email: senderEmail,
      },
      to: [{ email: to }],
      subject: "Verify your email - Job Hunt",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 12px;">
          <h2 style="color: #6B3AC2;">Job Hunt</h2>
          <p style="color: #555;">Use the code below to verify your email address.</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111; text-align: center; padding: 16px 0;">
            ${otp}
          </div>
          <p style="color: #888; font-size: 13px;">
            This code will expire in 10 minutes. If you didn't request this, you can ignore this email.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    console.error("Brevo email error:", response.status, errorDetails);
    throw new Error("Failed to send OTP email");
  }

  return await response.json();
};
