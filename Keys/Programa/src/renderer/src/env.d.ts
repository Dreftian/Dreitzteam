/// <reference types="vite/client" />
import type { KeysApi } from '../../preload';

declare global {
  interface Window {
    api: KeysApi;
  }
}

export {};
