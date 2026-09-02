import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import VisionTracker from './components/VisionTracker/VisionTracker'
import About from './pages/About/About'
import Heatmap from './pages/Heatmap/Heatmap'
import './App.css'

function TrackerRouteShell() {
  const { pathname } = useLocation()

  return (
    <>
      <Layout headerOnly showHeader={pathname === '/'} />
      <VisionTracker />
      <Outlet />
    </>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<TrackerRouteShell />}>
        <Route index element={null} />
        <Route path="calibration" element={null} />
        <Route path="tracking" element={null} />
      </Route>

      <Route element={<Layout />}>
        <Route path="/heatmap" element={<Heatmap />} />
        <Route path="/about" element={<About />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
