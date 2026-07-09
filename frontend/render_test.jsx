import React from 'react';
import { renderToString } from 'react-dom/server';
import AdminSettingsPage from './src/pages/admin/AdminSettingsPage.jsx';

try {
  console.log(renderToString(<AdminSettingsPage />));
} catch (e) {
  console.error("REACT RENDER ERROR:", e);
}
