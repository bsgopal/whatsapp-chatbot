import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            border: '1px solid #D7E1EC',
            color: '#0F172A',
            boxShadow: '0 18px 48px rgba(15, 23, 42, 0.12)',
            fontFamily: 'Manrope, sans-serif',
            fontSize: '13px',
            borderRadius: '16px',
          },
          success: { iconTheme: { primary: '#2563EB', secondary: '#FFFFFF' } },
          error: { iconTheme: { primary: '#E11D48', secondary: '#FFFFFF' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
