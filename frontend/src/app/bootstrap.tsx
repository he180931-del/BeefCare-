import ReactDOM from 'react-dom/client'
import { AppProviders } from './providers/AppProviders'
import AppRoutes from './routes/AppRoutes'
import './styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')
ReactDOM.createRoot(root).render(
  <AppProviders><AppRoutes /></AppProviders>,
)
