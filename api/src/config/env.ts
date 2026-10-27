
import "dotenv/config";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const supabaseUrl            = requiredEnv("SUPABASE_URL");
const supabaseAnonKey        = requiredEnv("SUPABASE_ANON_KEY");
const supabaseServiceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

try {
  new URL(supabaseUrl);
} catch {
  throw new Error("SUPABASE_URL must be a valid URL");
}

export const env = {
  port          : Number(process.env.PORT ?? 3001),
  nodeEnv       : process.env.NODE_ENV ?? "development",
  adminAppOrigin: requiredEnv("ADMIN_APP_ORIGIN"),
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
};
