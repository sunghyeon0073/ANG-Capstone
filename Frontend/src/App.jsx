import { RouterProvider } from 'react-router-dom'
import router from './router/router'
import Toast from './components/common/Toast'
import AlertToast from './components/common/AlertToast'
import { AiGenerationProvider } from './contexts/AiGenerationContext'

function App() {
  return (
    <AiGenerationProvider>
      <RouterProvider router={router} />
      <Toast />
      <AlertToast />
    </AiGenerationProvider>
  )
}

export default App
