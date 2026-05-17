/// <reference types="vite/client" />

import type { DreitzApi } from '../../preload';

declare global {
  interface Window {
    api: DreitzApi;
  }
}

export {};
