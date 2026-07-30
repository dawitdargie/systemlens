/**
 * Environment variable validation utility.
 * Ensures required configuration is present at runtime.
 */

export function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}