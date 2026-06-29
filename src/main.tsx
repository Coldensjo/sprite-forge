import { invoke } from '@tauri-apps/api/core';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';
import './index.css';
import { registerLuaFormats } from './lib/formats/lua';
import { registerFormat } from './lib/formats/registry';
import { tibiaHandler } from './lib/formats/tibia/handler';

if (typeof window !== 'undefined') {
	document.addEventListener('contextmenu', (e) => {
		e.preventDefault();
	});

	window.addEventListener('dragover', (e) => {
		e.preventDefault();
	});
	window.addEventListener('drop', (e) => {
		if (!(e.target as null | HTMLElement)?.closest('[data-file-drop="true"]')) {
			e.preventDefault();
		}
	});
}

function namespaceLocalStorage(ns: string) {
	const real = window.localStorage;
	const prefix = ns + ':';
	const shim: Storage = {
		key: (i) => real.key(i),
		clear: () => real.clear(),
		getItem: (k) => real.getItem(prefix + k),
		get length() {
			return real.length;
		},
		setItem: (k, v) => real.setItem(prefix + k, v),
		removeItem: (k) => real.removeItem(prefix + k)
	};
	Object.defineProperty(window, 'localStorage', { value: shim, configurable: true });
}

async function boot() {
	let clientVersions = true;
	let appName: string | undefined;
	let dataDir: string | undefined;
	try {
		const ui = await invoke<{ clientVersions: boolean }>('forge_ui_config');
		clientVersions = ui.clientVersions;
	} catch {
		void 0;
	}
	try {
		const app = await invoke<{ name?: string; dataDir?: string }>('forge_app_config');
		appName = app.name ?? undefined;
		dataDir = app.dataDir ?? undefined;
	} catch {
		void 0;
	}

	if (dataDir) namespaceLocalStorage(dataDir);

	if (clientVersions) registerFormat(tibiaHandler);
	await registerLuaFormats();

	if (appName) {
		document.title = appName;
		try {
			const { getCurrentWindow } = await import('@tauri-apps/api/window');
			await getCurrentWindow().setTitle(appName);
		} catch {
			void 0;
		}
	}

	createRoot(document.getElementById('root')!).render(<App />);
}

void boot();
