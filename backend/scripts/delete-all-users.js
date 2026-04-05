const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');

const deleteAllUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wa_appt_os');
    console.log('Connected to MongoDB\n');

    const result = await User.deleteMany({});
    console.log(`Deleted ${result.deletedCount} users from database\n`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

deleteAllUsers();
