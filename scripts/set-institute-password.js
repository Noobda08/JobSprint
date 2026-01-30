/*
 * Dev-only helper to set an institute user's password hash.
 *
 * Usage:
 *   node scripts/set-institute-password.js <email|userId> <password>
 */

const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../lib/_supabase');

function exitWithError(message) {
  console.error(message);
  process.exit(1);
}

async function fetchUser(identifier) {
  if (identifier.includes('@')) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserByEmail(identifier);
    if (error) {
      throw new Error(error.message || String(error));
    }
    return data?.user || null;
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(identifier);
  if (error) {
    throw new Error(error.message || String(error));
  }
  return data?.user || null;
}

async function setPassword() {
  const [, , identifier, password] = process.argv;

  if (!identifier || !password) {
    exitWithError('Usage: node scripts/set-institute-password.js <email|userId> <password>');
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    exitWithError('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }

  const user = await fetchUser(identifier.trim());
  if (!user) {
    exitWithError('Unable to find institute user with the provided identifier.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userMetadata = { ...(user.user_metadata || {}), password_hash: passwordHash };

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: userMetadata,
  });

  if (updateError) {
    exitWithError(updateError.message || String(updateError));
  }

  console.log(`Updated password hash for ${user.email || user.id}.`);
}

setPassword().catch((error) => {
  exitWithError(error.message || String(error));
});
