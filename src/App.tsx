import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { ThemeProvider } from '@/usecase/context/ThemeContext';
import { Route, Routes, BrowserRouter } from 'react-router-dom';
import { DragDropProvider } from '@/usecase/context/DragDropContext';
import { TibiaDataProvider } from '@/usecase/context/TibiaDataContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorDialogProvider } from '@/usecase/context/ErrorDialogContext';
import { PanelSettingsProvider } from '@/usecase/context/PanelSettingsContext';
import { GeneralSettingsProvider } from '@/usecase/context/GeneralSettingsContext';

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
