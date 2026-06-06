import React from 'react';
import { Home, Monitor, Download, FileText } from 'lucide-react';

export const quickAccessIcons: Record<string, React.ReactNode> = {
	Home: <Home size={14} className="fb-tree-icon" />,
	Desktop: <Monitor size={14} className="fb-tree-icon" />,
	Documents: <FileText size={14} className="fb-tree-icon" />,
	Downloads: <Download size={14} className="fb-tree-icon" />
};
