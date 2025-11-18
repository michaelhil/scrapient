import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

interface ProcessInfo {
  pid: number;
  port: number;
  startTime: number;
}

export const createProcessGuard = (port: number) => {
  const lockFile = path.join(process.cwd(), '.scrapient.lock');

  const isProcessRunning = async (pid: number): Promise<boolean> => {
    try {
      // Check if process is still running
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  const acquireLock = async (): Promise<boolean> => {
    try {
      // Check if lock file exists
      if (existsSync(lockFile)) {
        const lockContent = await fs.readFile(lockFile, 'utf-8');
        const processInfo: ProcessInfo = JSON.parse(lockContent);

        // Check if the process is still running
        const stillRunning = await isProcessRunning(processInfo.pid);

        if (stillRunning) {
          console.error(`❌ Another Scrapient server is already running:`);
          console.error(`   PID: ${processInfo.pid}`);
          console.error(`   Port: ${processInfo.port}`);
          console.error(`   Started: ${new Date(processInfo.startTime).toLocaleString()}`);
          console.error(`\n💡 To stop the existing server:`);
          console.error(`   kill ${processInfo.pid}`);
          console.error(`   or remove the lock file: rm .scrapient.lock`);
          return false;
        } else {
          // Stale lock file, remove it
          await fs.unlink(lockFile);
          console.log('🧹 Removed stale lock file');
        }
      }

      // Create new lock file
      const processInfo: ProcessInfo = {
        pid: process.pid,
        port,
        startTime: Date.now()
      };

      await fs.writeFile(lockFile, JSON.stringify(processInfo, null, 2));

      // Set up cleanup on process exit
      const cleanup = async (): Promise<void> => {
        try {
          if (existsSync(lockFile)) {
            await fs.unlink(lockFile);
            console.log('🧹 Cleaned up lock file');
          }
        } catch (error) {
          console.warn('Warning: Failed to cleanup lock file:', error);
        }
      };

      // Register cleanup handlers
      process.on('exit', () => cleanup());
      process.on('SIGINT', async () => {
        await cleanup();
        process.exit(0);
      });
      process.on('SIGTERM', async () => {
        await cleanup();
        process.exit(0);
      });
      process.on('uncaughtException', async (error) => {
        console.error('Uncaught Exception:', error);
        await cleanup();
        process.exit(1);
      });

      return true;
    } catch (error) {
      console.error('Failed to acquire process lock:', error);
      return false;
    }
  };

  const releaseLock = async (): Promise<void> => {
    try {
      if (existsSync(lockFile)) {
        await fs.unlink(lockFile);
      }
    } catch (error) {
      console.warn('Warning: Failed to release lock:', error);
    }
  };

  return {
    acquireLock,
    releaseLock
  };
};