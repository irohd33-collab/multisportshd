import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Watch from './pages/Watch.jsx';
import Download from './pages/Download.jsx';
import WindowsGuide from './pages/WindowsGuide.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/watch/:id" element={<Watch />} />
      <Route path="/indir" element={<Download />} />
      <Route path="/download" element={<Download />} />
      <Route path="/indir-windows-talimat" element={<WindowsGuide />} />
    </Routes>
  );
}
