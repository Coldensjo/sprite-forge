import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TibiaDataProvider } from '@/contexts/TibiaDataContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { FindWindow } from '@/components/FindWindow';

const queryClient = new QueryClient();

const FindApp = () => (
	<QueryClientProvider client={queryClient}>
		<ThemeProvider>
			<TooltipProvider>
				<TibiaDataProvider>
					<FindWindow />
					<Toaster />
				</TibiaDataProvider>
			</TooltipProvider>
		</ThemeProvider>
	</QueryClientProvider>
);

export default FindApp;








