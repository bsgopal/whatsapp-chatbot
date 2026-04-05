/**
 * WA Appt OS — Reset user password
 * Usage:
 *   node scripts/reset-password.js --email=you@email.com --password=newpassword123
 *   node scripts/reset-password.js  (interactive)
 */

const mongoose = require('mongoose');
const readline = require('readline');
const dotenv   = require('dotenv');
dotenv.config();

const User = require('../models/User');

const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

function getArg(name) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : null;
}

function prompt(rl, question) {
  return new Promise(resolve => rl.question(question + ': ', ans => resolve(ans.trim())));
}

async function main() {
  console.log(c.bold(c.cyan('\n  🔑 WA Appt OS — Password Reset\n')));

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wa_appt_os');
  console.log(c.dim('  Connected to MongoDB\n'));

  let email    = getArg('email');
  let password = getArg('password');

  if (!email || !password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    email    = await prompt(rl, c.cyan('  Email'));
    password = await prompt(rl, c.cyan('  New Password (min 8 chars)'));
    rl.close();
  }

  if (password.length < 8) {
    console.log(c.red('\n  ❌ Password must be at least 8 characters\n'));
    process.exit(1);
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.log(c.red(`\n  ❌ No user found with email: ${email}`));
    console.log(c.dim('  Run: node scripts/list-users.js to see all users\n'));
    process.exit(1);
  }

  // Update password — pre-save hook will hash it
  user.password = password;
  await user.save();

  console.log(c.green(`\n  ✅ Password updated for ${user.name} (${user.email})`));
  console.log(c.dim(`  Login at: http://localhost:5173\n`));

  await mongoose.disconnect();
}

main().catch(err => { console.error(c.red(err.message)); process.exit(1); });
