import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setPlatformBridge } from '../../web/src/platform/platformBridge';
import { setStorageAdapter } from '../../web/src/storage/storageAdapter';
import App from './App';
import { tauriBridge } from './platform/tauriBridge';
import { tauriStorageAdapter } from './storage/tauriStorageAdapter';

const queryClient = new QueryClient();
setStorageAdapter(tauriStorageAdapter);
setPlatformBridge(tauriBridge);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
