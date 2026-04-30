import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import 'mdui/mdui.css';
import 'mdui';
import './styles/app.css';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
