import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Toaster } from '~/components/ui/toaster';
import { SlicerWindow } from '~/components/SlicerWindow';
import { TooltipProvider } from '~/components/ui/tooltip';
import { ThemeProvider } from '~/usecase/context/ThemeContext';
import { AssetDataProvider } from '~/usecase/context/AssetDataContext';

const queryClient = new QueryClient();

const SlicerApp = () => (
	<QueryClientProvider client={queryClient}>
		<ThemeProvider>
			<TooltipProvider>
				<AssetDataProvider>
					<SlicerWindow />
					<Toaster />
				</AssetDataProvider>
			</TooltipProvider>
		</ThemeProvider>
	</QueryClientProvider>
);

export default SlicerApp;
