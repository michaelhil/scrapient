import type { Storage } from '../storage/types';
import { createUploadHandler } from './handlers/uploadHandler';

export const createUploadHandlers = (storage: Storage) => {
  return createUploadHandler(storage);
};