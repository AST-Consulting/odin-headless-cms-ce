export function getSMSOtpMessage(name: string, otp: string): string {
  const message = `${otp} ${process.env.SMS_MSG}`;

  return message;
}
