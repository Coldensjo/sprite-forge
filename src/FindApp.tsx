import { Toaster } from '@/components/ui/toaster';
import { FindWindow } from '@/components/FindWindow';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DragDropProvider } from '@/contexts/DragDropContext';
import { TibiaDataProvider } from '@/contexts/TibiaDataContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const FindApp = () => (
	<QueryClientProvider client={queryClient}>
		<ThemeProvider>
			<TooltipProvider>
				<TibiaDataProvider>
					<DragDropProvider>
						<FindWindow />
						<Toaster />
					</DragDropProvider>
				</TibiaDataProvider>
			</TooltipProvider>
		</ThemeProvider>
	</QueryClientProvider>
);

export default FindApp;
