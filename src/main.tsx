import { createRoot } from 'react-dom/client';

import App from './App.tsx';
import './index.css';
// Initialize debug control (exposes window.__debugControl)
import './lib/debugControl';

// Enable HTML5 Drag and Drop in Tauri by preventing default browser behavior
// This is required because Tauri's window dragging can interfere with DnD
if (typeof window !== 'undefined') {
	// Prevent default drag/drop behavior on document to enable HTML5 DnD
	document.addEventListener(
		'dragover',
		(e) => {
			e.preventDefault();
			e.dataTransfer!.dropEffect = 'none'; // Default to 'none', components will override
		},
		false
	);

	document.addEventListener(
		'drop',
		(e) => {
			e.preventDefault(); // Prevent default file opening
		},
		false
	);
}

createRoot(document.getElementById('root')!).render(<App />);
