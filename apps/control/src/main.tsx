// Entry point of the control page: mounts <App /> into index.html.
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { ptBR } from './i18n/ptBR';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('index.html must contain an element with id "root"');
}

document.title = ptBR.app.title;

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
