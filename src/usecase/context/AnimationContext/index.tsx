import React from 'react';

interface AnimationContextValue {
	isPlaying: boolean;
	currentFrame: number;
	setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
	setCurrentFrame: React.Dispatch<React.SetStateAction<number>>;
}

const AnimationContext = React.createContext<null | AnimationContextValue>(null);

export const AnimationProvider = ({ children }: { children: React.ReactNode }) => {
	const [isPlaying, setPlaying] = React.useState(false);
	const [currentFrame, setCurrentFrame] = React.useState(0);
	const value = React.useMemo(() => ({ isPlaying, setPlaying, currentFrame, setCurrentFrame }), [isPlaying, currentFrame]);
	return <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>;
};

export const useAnimation = (): AnimationContextValue => {
	const ctx = React.useContext(AnimationContext);
	if (!ctx) throw new Error('useAnimation must be used within AnimationProvider');
	return ctx;
};
