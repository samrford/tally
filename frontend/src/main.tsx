import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { routeTree } from './routeTree.gen'
import { AuthProvider, useAuth } from './lib/auth'
import { ThemeProvider } from './lib/theme'
import './index.css'

const queryClient = new QueryClient()

const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function InnerApp() {
  const auth = useAuth()
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }
  return <RouterProvider router={router} context={{ auth }} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <InnerApp />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
