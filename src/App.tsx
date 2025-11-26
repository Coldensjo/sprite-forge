import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { DragDropProvider } from '@/contexts/DragDropContext';
import { Route, Routes, BrowserRouter } from 'react-router-dom';
import { TibiaDataProvider } from '@/contexts/TibiaDataContext';
import { PanelSettingsProvider } from '@/contexts/PanelSettingsContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Index from './pages/Index';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const App = () => (
	<QueryClientProvider client={queryClient}>
		<ThemeProvider>
			<TooltipProvider>
				<TibiaDataProvider>
					<PanelSettingsProvider>
						<DragDropProvider>
							<Toaster />
							<Sonner />
							<BrowserRouter>
								<Routes>
									<Route path="/" element={<Index />} />
									{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
									<Route path="*" element={<NotFound />} />
								</Routes>
							</BrowserRouter>
						</DragDropProvider>
					</PanelSettingsProvider>
				</TibiaDataProvider>
			</TooltipProvider>
		</ThemeProvider>
	</QueryClientProvider>
);

export default App;
