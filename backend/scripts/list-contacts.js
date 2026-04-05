const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { Contact } = require('../models/index');

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wa_appt_os');
  const contacts = await Contact.find({}).lean();
  console.log(`Found ${contacts.length} contacts`);
  contacts.forEach((c, i) => console.log(`${i+1}. ${c.name} - ${c.phone} (${c.waId})`));
  await mongoose.disconnect();
}

main().catch(console.error);