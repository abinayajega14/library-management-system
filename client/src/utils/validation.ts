const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRequired(value: string, label: string): string | undefined {
  return value.trim() ? undefined : `${label} is required`;
}

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) {
    return "Email is required";
  }
  return emailPattern.test(value.trim()) ? undefined : "Enter a valid email address";
}

export function validatePassword(
  value: string,
  minimumLength = 1,
): string | undefined {
  if (!value) {
    return "Password is required";
  }
  if (value.length < minimumLength) {
    return `Password must be at least ${minimumLength} characters`;
  }
  return undefined;
}
