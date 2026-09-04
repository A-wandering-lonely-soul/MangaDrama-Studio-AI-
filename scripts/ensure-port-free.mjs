import { execSync } from 'node:child_process';
import { platform } from 'node:os';

const portInput = process.argv[2] ?? '3300';
const port = Number(portInput);

if (!Number.isInteger(port) || port <= 0) {
  console.error(`[port-guard] invalid port: ${portInput}`);
  process.exit(1);
}

function run(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
}

function unique(values) {
  return [...new Set(values)];
}

function killOnWindows(targetPort) {
  let output = '';
  try {
    output = run('netstat -ano -p tcp');
  } catch {
    return [];
  }

  const pids = [];
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('TCP')) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length < 5) {
      continue;
    }

    const local = parts[1];
    const state = parts[3];
    const pid = Number(parts[4]);
    const portText = local.slice(local.lastIndexOf(':') + 1);

    if (state !== 'LISTENING' || Number(portText) !== targetPort || !Number.isInteger(pid)) {
      continue;
    }

    pids.push(pid);
  }

  const uniquePids = unique(pids).filter((pid) => pid !== process.pid);
  for (const pid of uniquePids) {
    try {
      run(`taskkill /PID ${pid} /F`);
      console.log(`[port-guard] killed pid ${pid} on port ${targetPort}`);
    } catch {
      console.warn(`[port-guard] failed to kill pid ${pid}`);
    }
  }

  return uniquePids;
}

function killOnUnix(targetPort) {
  let output = '';
  try {
    output = run(`lsof -ti tcp:${targetPort}`);
  } catch {
    return [];
  }

  const pids = unique(
    output
      .split(/\r?\n/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0 && value !== process.pid)
  );

  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
      console.log(`[port-guard] killed pid ${pid} on port ${targetPort}`);
    } catch {
      console.warn(`[port-guard] failed to kill pid ${pid}`);
    }
  }

  return pids;
}

const killed = platform() === 'win32' ? killOnWindows(port) : killOnUnix(port);
if (killed.length === 0) {
  console.log(`[port-guard] port ${port} is already free`);
}
