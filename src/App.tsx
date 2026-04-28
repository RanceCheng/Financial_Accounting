import { useEffect, useState } from 'react'
import { HashRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AppRouter } from '@/app/router'
import { seedIfEmpty } from '@/data/seed'

function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    seedIfEmpty().then(() => setReady(true)).catch(console.error)
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">載入中...</p>
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
      <AppLayout>
        <AppRouter />
      </AppLayout>
    </HashRouter>
  )
}

export default App
