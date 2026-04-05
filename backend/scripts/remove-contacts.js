/**
 * WA Appt OS — Remove all contacts except specified phone
 * Usage: node scripts/remove-contacts.js [phone]
 */

const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config();

const { Contact } = require('../models/index');

const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

async function main() {
  const keepPhone = process.argv[2] || '9345578103';
  
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wa_appt_os');

  console.log(c.bold(`\n  📞 Removing all contacts except ${keepPhone}\n`));

  // Find the contact to keep
  const contactToKeep = await Contact.findOne({ phone: keepPhone });
  
  if (!contactToKeep) {
    console.log(c.red(`  Contact with phone ${keepPhone} not found!\n`));
    process.exit(1);
  }

  console.log(c.cyan(`  Keeping contact: ${contactToKeep.name} (${contactToKeep.phone})\n`));

  // Count contacts to remove
  const contactsToRemove = await Contact.countDocuments({ phone: { $ne: keepPhone } });
  
  if (contactsToRemove === 0) {
    console.log(c.yellow('  No contacts to remove.\n'));
    process.exit(0);
  }

  console.log(c.yellow(`  Will remove ${contactsToRemove} contacts...\n`));

  // Remove contacts
  const result = await Contact.deleteMany({ phone: { $ne: keepPhone } });
  
  console.log(c.green(`  ✅ Removed ${result.deletedCount} contacts\n`));
  console.log(c.green(`  📞 Kept 1 contact: ${contactToKeep.name} (${contactToKeep.phone})\n`));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(c.red('Error:'), err.message);
  process.exit(1);
});