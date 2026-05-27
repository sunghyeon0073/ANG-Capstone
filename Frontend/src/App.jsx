import { RouterProvider } from 'react-router-dom'
import router from './router/router'
import Toast from './components/Toast'
import { AiGenerationProvider } from './contexts/AiGenerationContext'

function App() {
  return (
    <AiGenerationProvider>
      <RouterProvider router={router} />
      <Toast />
    </AiGenerationProvider>
  )
}

export default App
