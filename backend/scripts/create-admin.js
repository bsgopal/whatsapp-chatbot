/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║         WA Appt OS — Admin / Developer Setup             ║
 * ║   Creates your personal owner account + business         ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   node scripts/create-admin.js
 *
 *   Or with args (non-interactive):
 *   node scripts/create-admin.js --name="Your Name" --email="you@email.com" --password="yourpass123" --business="Your Business"
 */

const mongoose = require('mongoose');
const readline = require('readline');
const dotenv = require('dotenv');
dotenv.config();

const User   = require('../models/User');
const Business = require('../models/Business');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wa_appt_os';

// ─── Color helpers ────────────────────────────────────────────────────────────
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

// ─── Arg parser ────────────────────────────────────────────────────────────────
function getArg(name) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : null;
}

// ─── Prompt helper ────────────────────────────────────────────────────────────
function prompt(rl, question, defaultVal = '') {
  return new Promise((resolve) => {
    const display = defaultVal ? `${question} ${c.dim(`(${defaultVal})`)} : ` : `${question}: `;
    rl.question(display, (answer) => {
      resolve(answer.trim() || defaultVal);
    });
  });
}

function promptPassword(rl, question) {
  return new Promise((resolve) => {
    process.stdout.write(`${question}: `);
    // Hide input on Unix; on Windows it will still show
    if (process.stdin.isTTY) process.stdin.setRawMode?.(true);
    let password = '';
    const onData = (char) => {
      char = char.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        if (process.stdin.isTTY) process.stdin.setRawMode?.(false);
        process.stdout.write('\n');
        process.stdin.removeListener('data', onData);
        process.stdin.pause();
        resolve(password);
      } else if (char === '\u0003') {
        process.exit();
      } else if (char === '\u007F' || char === '\b') {
        password = password.slice(0, -1);
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(`${question}: ${'*'.repeat(password.length)}`);
      } else {
        password += char;
        process.stdout.write('*');
      }
    };
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + c.bold(c.green('╔══════════════════════════════════════════════╗')));
  console.log(c.bold(c.green('║     WA Appt OS — Admin Account Setup         ║')));
  console.log(c.bold(c.green('╚══════════════════════════════════════════════╝')));
  console.log(c.dim(`  MongoDB: ${MONGO_URI}\n`));

  // ── Connect ──────────────────────────────────────────────────────────────────
  try {
    await mongoose.connect(MONGO_URI);
    console.log(c.green('✅ Connected to MongoDB\n'));
  } catch (err) {
    console.error(c.red(`❌ MongoDB connection failed: ${err.message}`));
    console.log(c.yellow('   Make sure MongoDB is running or check your MONGO_URI in .env'));
    process.exit(1);
  }

  // ── Check if args passed (non-interactive mode) ──────────────────────────────
  const argName     = getArg('name');
  const argEmail    = getArg('email');
  const argPassword = getArg('password');
  const argBusiness = getArg('business');
  const argPhone    = getArg('phone');
  const argCategory = getArg('category');

  let name, email, password, phone, businessName, businessCategory;

  if (argName && argEmail && argPassword && argBusiness) {
    // Non-interactive — use args
    name             = argName;
    email            = argEmail;
    password         = argPassword;
    phone            = argPhone    || '';
    businessName     = argBusiness;
    businessCategory = argCategory || 'salon';
    console.log(c.cyan('⚡ Running in non-interactive mode (using --args)\n'));
  } else {
    // Interactive prompts
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log(c.bold('👤  Your Details'));
    console.log(c.dim('   ─────────────────────────────────────────\n'));

    name  = await prompt(rl, c.cyan('  Full Name         '), 'Developer Admin');
    email = await prompt(rl, c.cyan('  Email             '), 'admin@waappt.com');
    phone = await prompt(rl, c.cyan('  Phone (optional)  '), '');

    // Password
    let passwordConfirm = '';
    while (true) {
      password        = await promptPassword(rl, c.cyan('  Password (min 8)  '));
      if (password.length < 8) {
        console.log(c.red('  ⚠  Password must be at least 8 characters. Try again.'));
        continue;
      }
      passwordConfirm = await promptPassword(rl, c.cyan('  Confirm Password  '));
      if (password !== passwordConfirm) {
        console.log(c.red('  ⚠  Passwords do not match. Try again.\n'));
      } else {
        break;
      }
    }

    console.log('\n' + c.bold('🏢  Your Business'));
    console.log(c.dim('   ─────────────────────────────────────────\n'));

    businessName = await prompt(rl, c.cyan('  Business Name     '), 'My Business');

    console.log(c.dim('  Categories: salon | medical | automotive | education | fitness | spa | dental | legal | other'));
    businessCategory = await prompt(rl, c.cyan('  Category          '), 'salon');

    // Validate category
    const validCats = ['salon','medical','automotive','education','fitness','spa','dental','legal','other'];
    if (!validCats.includes(businessCategory.toLowerCase())) {
      businessCategory = 'salon';
      console.log(c.yellow(`  ⚠  Invalid category, defaulting to 'salon'`));
    }

    rl.close();
  }

  // ── Check if email already exists ────────────────────────────────────────────
  console.log(c.dim('\n  Checking for existing account...'));
  const existing = await User.findOne({ email: email.toLowerCase() });

  if (existing) {
    console.log(c.yellow(`\n⚠  Account with email "${email}" already exists!`));
    console.log(`   Name:  ${existing.name}`);
    console.log(`   Role:  ${existing.role}`);
    console.log(`   ID:    ${existing._id}`);
    console.log(c.dim('\n   Use the login page with these credentials.'));
    console.log(c.dim('   Or delete the account first: node scripts/delete-user.js --email=' + email));
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── Create User ───────────────────────────────────────────────────────────────
  console.log(c.dim('  Creating owner account...'));
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    phone: phone || undefined,
    role: 'super_admin',
    isActive: true,
  });

  // ── Create Business ───────────────────────────────────────────────────────────
  console.log(c.dim('  Creating business profile...'));
  const business = await Business.create({
    name: businessName,
    category: businessCategory.toLowerCase(),
    owner: user._id,
    phone: phone || undefined,
    subscription: {
      plan: 'pro',              // Give yourself Pro plan
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    },
    botSettings: {
      isEnabled: true,
      welcomeMessage: `Hello! 👋 Welcome to ${businessName}. How can I help you today?\n\n1️⃣ Book Appointment\n2️⃣ View My Bookings\n3️⃣ Our Services\n4️⃣ Talk to Staff`,
      autoConfirm: false,
      reminderEnabled: true,
      reminderBeforeHours: 24,
    },
  });

  // ── Link business to user ─────────────────────────────────────────────────────
  user.business = business._id;
  await user.save({ validateBeforeSave: false });

  // ── Generate token preview ────────────────────────────────────────────────────
  const token = user.getSignedJwt();

  // ── Success output ────────────────────────────────────────────────────────────
  console.log('\n' + c.bold(c.green('╔══════════════════════════════════════════════╗')));
  console.log(c.bold(c.green('║           ✅ Account Created!                 ║')));
  console.log(c.bold(c.green('╚══════════════════════════════════════════════╝')));

  console.log(`
  ${c.bold('👤 User')}
  ┌─────────────────────────────────────────────
  │  Name      : ${c.cyan(user.name)}
  │  Email     : ${c.cyan(user.email)}
  │  Role      : ${c.green('super_admin')} ${c.dim('(full access)')}
  │  User ID   : ${c.dim(user._id.toString())}
  └─────────────────────────────────────────────

  ${c.bold('🏢 Business')}
  ┌─────────────────────────────────────────────
  │  Name      : ${c.cyan(business.name)}
  │  Category  : ${c.cyan(business.category)}
  │  Plan      : ${c.green('Pro')} ${c.dim('(1 year active)')}
  │  Biz ID    : ${c.dim(business._id.toString())}
  └─────────────────────────────────────────────

  ${c.bold('🔑 Login')}
  ┌─────────────────────────────────────────────
  │  URL       : ${c.cyan('http://localhost:5173')}
  │  Email     : ${c.cyan(user.email)}
  │  Password  : ${c.cyan('[what you entered]')}
  └─────────────────────────────────────────────

  ${c.bold('🔐 JWT Token')} ${c.dim('(use in Postman/API testing)')}
  ┌─────────────────────────────────────────────
  │  ${c.dim(token.substring(0, 60) + '...')}
  └─────────────────────────────────────────────
`);

  console.log(c.bold('  Next steps:'));
  console.log(c.dim('  1. Run backend:  cd backend && npm run dev'));
  console.log(c.dim('  2. Run frontend: cd frontend && npm run dev'));
  console.log(c.dim('  3. Open: http://localhost:5173'));
  console.log(c.dim(`  4. Login with: ${user.email}\n`));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(c.red(`\n❌ Error: ${err.message}`));
  if (err.code === 11000) {
    console.log(c.yellow('   This email is already registered. Use a different email.'));
  }
  mongoose.disconnect();
  process.exit(1);
});
