/*
 * Bootstrap a creator user.
 *
 * Usage:
 *   node scripts/bootstrap-creator.js --email shantanu@jobsprinter.xyz --password "JobsprintKaCreator" --name "Shantanu"
 */

const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../lib/_supabase');

function exitWithError(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (!value || value.startsWith('--')) {
        result[key] = true;
      } else {
        result[key] = value;
        i += 1;
      }
    }
  }

  return result;
}

async function bootstrap() {
  const { email, password, name } = parseArgs();

  if (!email || !password) {
    exitWithError('Usage: node scripts/bootstrap-creator.js --email <email> --password <password> --name <name>');
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    exitWithError('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { data, error } = await supabaseAdmin
    .from('creator_users')
    .upsert({
      email: email.trim().toLowerCase(),
      name: name || null,
      role: 'super_admin',
      password_hash: passwordHash,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' })
    .select('id, email, role, is_active')
    .single();

  if (error) {
    exitWithError(error.message || String(error));
  }

  console.log(`Creator user ready: ${data.email} (${data.role}).`);
}

bootstrap().catch((error) => {
  exitWithError(error.message || String(error));
});
