export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
};

export const validatePassword = (password: string): string | null => {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Must include an uppercase letter";
  if (!/[0-9]/.test(password)) return "Must include a number";
  return null;
};

export const validatePhone = (phone: string): boolean => {
  const re = /^[+]?[\d\s\-()]{10,15}$/;
  return re.test(phone.trim());
};

export const validateRequired = (value: string, field: string): string | null => {
  if (!value || value.trim().length === 0) return `${field} is required`;
  return null;
};

export const validateAge = (age: string): string | null => {
  const num = parseInt(age, 10);
  if (isNaN(num) || num < 0 || num > 120) return "Enter a valid age (0–120)";
  return null;
};