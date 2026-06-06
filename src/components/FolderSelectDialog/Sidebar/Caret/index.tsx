import { ChevronRight } from 'lucide-react';

export const Caret = ({ open }: { open: boolean }) => {
	return (
		<span className={'fb-caret' + (open ? ' fb-caret-open' : '')}>
			<ChevronRight size={14} />
		</span>
	);
};
