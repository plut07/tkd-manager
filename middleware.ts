/**
 * Utility script: (re)sets the Super Admin password.
 *
 * The initial "Admin" account is normally created by the SQL migrations
 * (supabase/migrations/0002_seed.sql) when you run them in the Supabase
 * SQL editor or via `supabase db push`. Use this script if you ever need
 * to reset the Admin password from the command line instead.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed -- --password "NewPass123!"
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
    process.exit(1);
  }

  const passwordFlagIndex = process.argv.indexOf("--password");
  const password = passwordFlagIndex >= 0 ? process.argv[passwordFlagIndex + 1] : "SuperAdmin@225588";
  if (!password || password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const passwordHash = await bcrypt.hash(password, 10);

  const { data: role } = await supabase.from("roles").select("id").eq("code", "super_admin").maybeSingle();
  if (!role) {
    console.error("The 'super_admin' role doesn't exist yet. Run the SQL migrations first.");
    process.exit(1);
  }

  const { data: existing } = await supabase.from("app_users").select("id").eq("username", "Admin").maybeSingle();

  if (existing) {
    await supabase.from("app_users").update({ password_hash: passwordHash, active: true }).eq("id", existing.id);
    console.log(`Updated password for existing "Admin" user.`);
  } else {
    await supabase.from("app_users").insert({
      username: "Admin",
      password_hash: passwordHash,
      full_name: "Super Administrator",
      role_id: role.id,
      active: true,
    });
    console.log(`Created "Admin" super admin user.`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
