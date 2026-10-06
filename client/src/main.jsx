import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';
import { TitleBar, SideNav, isDesktopApp } from './desktop/Shell.jsx';

function AppShell() {
  if (!isDesktopApp()) return <App />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TitleBar />
      <div style={{ display: 'flex', flex: 1 }}>
        <SideNav />
        <div style={{ flex: 1, minWidth: 0 }}><App /></div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  </React.StrictMode>
);
