import { Toaster } from '@/components/ui/toaster';
import { FindWindow } from '@/components/FindWindow';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/usecase/context/ThemeContext';
import { DragDropProvider } from '@/usecase/context/DragDropContext';
import { TibiaDataProvider } from '@/usecase/context/TibiaDataContext';
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
