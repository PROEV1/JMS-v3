import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import { DesignVersionProvider } from '@/contexts/DesignVersionContext'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <DesignVersionProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </DesignVersionProvider>
  </QueryClientProvider>
);
