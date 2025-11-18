import { spawn } from 'child_process';

interface PortInfo {
  port: number;
  pid: number;
  process: string;
}

export const createPortManager = () => {
  const checkPortInUse = async (port: number): Promise<PortInfo | null> => {
    return new Promise((resolve) => {
      // Use lsof to check if port is in use
      const lsof = spawn('lsof', ['-ti', `:${port}`]);
      let output = '';

      lsof.stdout.on('data', (data) => {
        output += data.toString();
      });

      lsof.on('close', async (code) => {
        if (code === 0 && output.trim()) {
          const pid = parseInt(output.trim());
          if (pid) {
            const processName = await getProcessName(pid);
            resolve({
              port,
              pid,
              process: processName
            });
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });

      lsof.on('error', () => {
        resolve(null);
      });
    });
  };

  const getProcessName = async (pid: number): Promise<string> => {
    return new Promise((resolve) => {
      const ps = spawn('ps', ['-p', pid.toString(), '-o', 'comm=']);
      let output = '';

      ps.stdout.on('data', (data) => {
        output += data.toString();
      });

      ps.on('close', () => {
        resolve(output.trim() || 'unknown');
      });

      ps.on('error', () => {
        resolve('unknown');
      });
    });
  };

  const findNextAvailablePort = async (startPort: number, maxTries: number = 10): Promise<number> => {
    for (let i = 0; i < maxTries; i++) {
      const port = startPort + i;
      const portInfo = await checkPortInUse(port);
      if (!portInfo) {
        return port;
      }
    }
    throw new Error(`No available ports found starting from ${startPort}`);
  };

  const killProcessOnPort = async (port: number): Promise<boolean> => {
    const portInfo = await checkPortInUse(port);
    if (!portInfo) {
      return false;
    }

    try {
      process.kill(portInfo.pid, 'SIGTERM');

      // Wait a moment and check if it's still running
      await new Promise(resolve => setTimeout(resolve, 1000));

      const stillRunning = await checkPortInUse(port);
      if (stillRunning) {
        // Force kill if graceful shutdown failed
        process.kill(portInfo.pid, 'SIGKILL');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return true;
    } catch (error) {
      console.warn(`Failed to kill process ${portInfo.pid}:`, error);
      return false;
    }
  };

  return {
    checkPortInUse,
    findNextAvailablePort,
    killProcessOnPort
  };
};