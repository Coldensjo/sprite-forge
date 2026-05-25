import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { DragDropProvider } from '@/contexts/DragDropContext';
import { Route, Routes, BrowserRouter } from 'react-router-dom';
import { TibiaDataProvider } from '@/contexts/TibiaDataContext';
import { ErrorDialogProvider } from '@/contexts/ErrorDialogContext';
import { PanelSettingsProvider } from '@/contexts/PanelSettingsContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GeneralSettingsProvider } from '@/contexts/GeneralSettingsContext';

import Index from './pages/Index';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const App = () => (
	<QueryClientProvider client={queryClient}>
		<ThemeProvider>
			<TooltipProvider>
				<ErrorDialogProvider>
					<TibiaDataProvider>
						<PanelSettingsProvider>
							<GeneralSettingsProvider>
								<DragDropProvider>
									<Toaster />
									<Sonner />
									<BrowserRouter>
										<Routes>
											<Route path="/" element={<Index />} />
											<Route path="*" element={<NotFound />} />
										</Routes>
									</BrowserRouter>
								</DragDropProvider>
							</GeneralSettingsProvider>
						</PanelSettingsProvider>
					</TibiaDataProvider>
				</ErrorDialogProvider>
			</TooltipProvider>
		</ThemeProvider>
	</QueryClientProvider>
);

export default App;
