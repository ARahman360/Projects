/** New-password rules must not lock out accounts created under older policies. */
export function passwordInputError(password: string, intent: "login" | "signup") {
  if (password.length > 200) return "Passwords cannot exceed 200 characters.";
  if (intent === "signup" && password.length < 10) return "Use a password between 10 and 200 characters.";
  if (!password.length) return "Enter your password.";
  return null;
}
