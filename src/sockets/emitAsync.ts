import type {Socket} from 'socket.io-client';

const DEFAULT_TIMEOUT = 10000;

export const emitAsync = (socket: Socket, ...args: any[]) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Socket emit timed out'));
    }, DEFAULT_TIMEOUT);
    (socket as any).emit(...args, (...ackArgs: any[]) => {
      clearTimeout(timer);
      resolve(ackArgs.length <= 1 ? ackArgs[0] : ackArgs);
    });
  });
