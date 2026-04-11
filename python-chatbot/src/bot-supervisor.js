const path = require("path");
const { spawn } = require("child_process");

const BOT_ENTRY = path.join(__dirname, "bot.js");
const RESTART_DELAY_MS = 3000;

let child = null;
let shuttingDown = false;
let restartTimer = null;

function clearRestartTimer() {
  if (!restartTimer) return;
  clearTimeout(restartTimer);
  restartTimer = null;
}

function scheduleRestart(reason) {
  if (shuttingDown || restartTimer) return;

  console.log(`🔁  WhatsApp bot stopped (${reason}). Restarting in ${RESTART_DELAY_MS / 1000}s...`);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    startChild();
  }, RESTART_DELAY_MS);
}

function startChild() {
  if (shuttingDown || child) return;

  console.log("🤖  Starting WhatsApp bot worker...");
  child = spawn(process.execPath, [BOT_ENTRY], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    windowsHide: false,
    env: {
      ...process.env,
      WA_BOT_SUPERVISED: "1",
    },
  });

  child.once("error", (err) => {
    console.error(`❌  Failed to launch WhatsApp bot worker: ${err.message}`);
    child = null;
    scheduleRestart("launch error");
  });

  child.once("exit", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `exit code ${code}`;
    child = null;

    if (shuttingDown) {
      process.exit(code ?? 0);
      return;
    }

    scheduleRestart(reason);
  });
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearRestartTimer();

  if (!child) {
    process.exit(0);
    return;
  }

  console.log(`🛑  Stopping WhatsApp bot worker with ${signal}...`);
  child.kill(signal);

  setTimeout(() => {
    if (child) {
      child.kill("SIGKILL");
    }
  }, 5000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startChild();
