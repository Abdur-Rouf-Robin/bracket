'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { useState, type ReactNode } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/auth';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={client}>
        <AuthProvider>
          <TooltipProvider delayDuration={250}>
            <AuthGate>{children}</AuthGate>
          </TooltipProvider>
          <Toaster
            richColors
            closeButton
            position="top-right"
            toastOptions={{
              classNames: {
                toast: 'font-[var(--font-body)]',
              },
            }}
          />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
