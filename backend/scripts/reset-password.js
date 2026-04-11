/**
 * WA Appt OS — Reset user password by PHONE NUMBER
 *
 * Usage (non-interactive):
 *   node scripts/reset-password.js --phone=9345578103 --password=mynewpass
 *
 * Usage (interactive):
 *   node scripts/reset-password.js
 *
 * Also shows all users so you can identify the right one.
 */

const mongoose = require('mongoose');
const readline = require('readline');
const dotenv   = require('dotenv');
dotenv.config();

const User     = require('../models/User');
const Business = require('../models/Business');

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

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function prompt(rl, question) {
  return new Promise(resolve => rl.question(question + ': ', ans => resolve(ans.trim())));
}

async function main() {
  console.log(c.bold(c.cyan('\n  🔑  WA Appt OS — Password Reset by Phone\n')));

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wa_appt_os');
  console.log(c.dim('  Connected to MongoDB\n'));

  // Always list users first so you can see what's there
  const allUsers = await User.find({}).populate('business', 'name').lean();
  console.log(c.bold(`  👥 Users in database (${allUsers.length}):`));
  console.log(c.dim('  ' + '─'.repeat(70)));
  allUsers.forEach((u, i) => {
    const roleTag = u.role === 'super_admin' ? c.yellow('[PLATFORM OWNER]')
                  : u.role === 'owner'       ? c.green('[owner]')
                  : c.dim('[' + u.role + ']');
    console.log(`  ${i + 1}. ${c.cyan(u.name.padEnd(20))} 📱 ${u.phone.padEnd(12)} ${roleTag}`);
    if (u.business) console.log(c.dim(`     └── Business: ${u.business.name}`));
  });
  console.log(c.dim('  ' + '─'.repeat(70) + '\n'));

  let rawPhone = getArg('phone');
  let password = getArg('password');

  if (!rawPhone || !password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rawPhone = await prompt(rl, c.cyan('  Phone number (10 digits)'));
    password = await prompt(rl, c.cyan('  New password (min 6 chars)'));
    rl.close();
  }

  const phone = normalizePhone(rawPhone);

  if (phone.length !== 10) {
    console.log(c.red('\n  ❌ Invalid phone number — must be 10 digits\n'));
    process.exit(1);
  }

  if (password.length < 6) {
    console.log(c.red('\n  ❌ Password must be at least 6 characters\n'));
    process.exit(1);
  }

  const user = await User.findOne({ phone });
  if (!user) {
    console.log(c.red(`\n  ❌ No user found with phone: ${phone}`));
    console.log(c.dim('  Check the list above for the correct phone number.\n'));
    process.exit(1);
  }

  // Pre-save hook will hash the password
  user.password = password;
  await user.save();

  const biz = user.business ? await Business.findById(user.business).lean() : null;

  console.log(c.green(`\n  ✅ Password updated for ${c.bold(user.name)}`));
  console.log(c.dim(`     Phone:    ${user.phone}`));
  console.log(c.dim(`     Role:     ${user.role}`));
  if (biz) console.log(c.dim(`     Business: ${biz.name}`));
  console.log(c.cyan(`\n  Login at: http://localhost:5173\n`));

  await mongoose.disconnect();
}

main().catch(err => { console.error(c.red('\n  ❌ ' + err.message + '\n')); process.exit(1); });