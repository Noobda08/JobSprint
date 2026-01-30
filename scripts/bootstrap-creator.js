/*
 * Bootstrap or update a creator (platform admin) user.
 *
 * Usage:
 *   node scripts/bootstrap-creator.js --email shantanu@jobsprinter.xyz --password "JobsprintKaCreator" --name "Shantanu"
 */

const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../api/_supabase');

function exitWithError(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--email') args.email = argv[i + 1];
    if (arg === '--password') args.password = argv[i + 1];
    if (arg === '--name') args.name = argv[i + 1];
  }
  return args;
}

async function bootstrapCreator() {
  const { email, password, name } = parseArgs(process.argv.slice(2));

  if (!email || !password) {
    exitWithError('Usage: node scripts/bootstrap-creator.js --email <email> --password <password> [--name <name>]');
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    exitWithError('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);

  const { data, error } = await supabaseAdmin
    .from('creator_users')
    .upsert(
      {
        email: normalizedEmail,
        name: name ? name.trim() : null,
        role: 'super_admin',
        password_hash: passwordHash,
        is_active: true,
      },
      { onConflict: 'email' }
    )
    .select('id, email, role, is_active')
    .maybeSingle();

  if (error) {
    exitWithError(error.message || String(error));
  }

  console.log(`Creator user ready: ${data?.email || normalizedEmail}`);
}

bootstrapCreator().catch((error) => {
  exitWithError(error.message || String(error));
});
