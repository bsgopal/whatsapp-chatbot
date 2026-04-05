/**
 * WA Appt OS — List all users
 * Usage: node scripts/list-users.js
 */

const mongoose = require('mongoose');
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

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wa_appt_os');

  const users = await User.find({}).populate('business', 'name category subscription.plan').lean();

  if (users.length === 0) {
    console.log(c.yellow('\n  No users found. Run: node scripts/create-admin.js\n'));
  } else {
    console.log(c.bold(`\n  👥 Users in database (${users.length} total)\n`));
    console.log(c.dim('  ' + '─'.repeat(80)));
    users.forEach((u, i) => {
      const roleColor = u.role === 'owner' ? c.green : u.role === 'admin' ? c.cyan : c.dim;
      console.log(`  ${c.bold(`${i + 1}.`)} ${c.cyan(u.name.padEnd(22))} ${u.email.padEnd(30)} ${roleColor(u.role.padEnd(14))} ${u.isActive ? c.green('active') : c.red('inactive')}`);
      if (u.business) {
        console.log(c.dim(`     └── Business: ${u.business.name} (${u.business.category}) · Plan: ${u.business.subscription?.plan || 'starter'}`));
      }
      console.log(c.dim(`     └── ID: ${u._id}  ·  Created: ${new Date(u.createdAt).toLocaleDateString()}`));
    });
    console.log(c.dim('  ' + '─'.repeat(80) + '\n'));
  }

  await mongoose.disconnect();
}

main().catch(err => { console.error(c.red(err.message)); process.exit(1); });
