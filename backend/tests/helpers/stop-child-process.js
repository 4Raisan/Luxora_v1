import { spawnSync } from 'node:child_process';

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function stopChildProcess(child, timeoutMs = 2000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  let exited = false;
  const onExit = () => {
    exited = true;
  };
  child.once('exit', onExit);

  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      exited = true;
    }
  } else {
    try {
      child.kill('SIGTERM');
    } catch {
      exited = true;
    }
  }

  const deadline = Date.now() + timeoutMs;
  while (!exited && Date.now() < deadline) await delay(25);

  if (!exited && process.platform !== 'win32') {
    try {
      child.kill('SIGKILL');
    } catch {
      exited = true;
    }
  }

  const killDeadline = Date.now() + 1000;
  while (!exited && Date.now() < killDeadline) await delay(25);
  child.removeListener('exit', onExit);
}
