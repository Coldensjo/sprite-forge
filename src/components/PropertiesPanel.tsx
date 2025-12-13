import type React from 'react';
import { cn } from '@/lib/utils';
import { ThingCategory } from '@/lib/tibia';
import { MarketCategory } from '@/lib/tibia';
import { invoke } from '@tauri-apps/api/core';
import { useTibiaData } from '@/contexts/TibiaDataContext';
import { useRef, useState, useEffect, useCallback } from 'react';
import {
	X,
	Play,
	Move,
	Save,
	Plus,
	Pause,
	Undo2,
	Blend,
	ZoomIn,
	ZoomOut,
	ArrowUp,
	Shuffle,
	Compass,
	TreePine,
	SkipBack,
	ChevronUp,
	ArrowDown,
	ArrowLeft,
	RotateCcw,
	ArrowRight,
	ChevronLeft,
	SkipForward,
	ChevronDown,
	ArrowUpLeft,
	ChevronRight,
	FileQuestion,
	ArrowUpRight,
	ArrowDownLeft,
	ArrowDownRight
} from 'lucide-react';

import { Label } from './ui/label';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { SpriteCanvas } from './SpriteCanvas';
import { CheckerBoard } from './CheckerBoard';
import { NumberInput } from './ui/number-input';
import { TibiaColorPicker } from './TibiaColorPicker';
import { EightBitColorPicker } from './EightBitColorPicker';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from './ui/select';
import {
	AlertDialog,
	AlertDialogTitle,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogContent,
	AlertDialogDescription
} from './ui/alert-dialog';

interface SceneItem {
	id: number;
	count?: number;
}

interface SceneTile {
	items: SceneItem[];
}

interface ItemPropertiesState {
	zoom: number;
	panX: number;
	panY: number;
	patternX: number;
	patternY: number;
	patternZ: number;
	showGrid: boolean;
	isPlaying: boolean;
	currentFrame: number;
	currentLayer: number;
	showExactSize: boolean;
	outfitData: {
		head: number;
		body: number;
		legs: number;
		feet: number;
		addons: boolean[];
	};
}

const getItemStateKey = (category: ThingCategory, id: number) => {
	return `sprite-forge-item-state-${category}-${id}`;
};

const loadItemState = (category: ThingCategory, id: number): null | Partial<ItemPropertiesState> => {
	try {
		if (typeof window !== 'undefined') {
			const key = getItemStateKey(category, id);
			const saved = localStorage.getItem(key);
			if (saved) {
				const parsed = JSON.parse(saved);
				// Verify we got valid data
				if (parsed && typeof parsed === 'object') {
					return parsed;
				}
			}
		}
	} catch (e) {
		console.error(`Failed to load item state for ${category}-${id} from localStorage:`, e);
	}
	return null;
};

const saveItemState = (category: ThingCategory, id: number, state: ItemPropertiesState) => {
	try {
		if (typeof window !== 'undefined') {
			localStorage.setItem(getItemStateKey(category, id), JSON.stringify(state));
		}
	} catch (e) {
		console.error('Failed to save item state to localStorage:', e);
	}
};

export const PropertiesPanel = () => {
	const {
		data,
		getThing,
		updateThing,
		openedItemId,
		updateCounter,
		setOpenedItemId,
		removeOpenedItem,
		selectedCategory,
		openedItemCategory,
		markUnsavedChanges,
		notifySpritesLoaded,
		setHighlightedSpriteId
	} = useTibiaData();
	const item = openedItemId && openedItemCategory ? getThing(openedItemId, openedItemCategory) : null;

	// Draft state for editing
	const [draftItem, setDraftItem] = useState<typeof item>(null);
	const [hasChanges, setHasChanges] = useState(false);
	const [showCloseConfirm, setShowCloseConfirm] = useState(false);
	const [selectedFrameGroup, setSelectedFrameGroup] = useState(0);
	const selectedFrameGroupRef = useRef(0);
	const originalItemRef = useRef<typeof item>(null);

	// Initialize draft when item changes
	useEffect(() => {
		if (item && openedItemId && openedItemCategory) {
			console.log('PropertiesPanel useEffect triggered:', {
				updateCounter,
				reason: 'item/updateCounter changed',
				itemFromContext: {
					id: item.id,
					frames: item.frames,
					spriteIndexLength: item.spriteIndex?.length,
					spriteIndexFirst20: item.spriteIndex?.slice(0, 20)
				}
			});

			let initialItem = { ...item };
			let initialGroup = 0;

			// For outfits, initialize frameGroupsData only for versions that support it (>= 1057)
			if (item.category === ThingCategory.OUTFIT) {
				const versionSupportsFrameGroups = (data?.version.value || 0) >= 1057;

				if (versionSupportsFrameGroups && (!initialItem.frameGroupsData || initialItem.frameGroupsData.length === 0)) {
					// Create default frame group from item properties (version >= 1057 only)
					initialItem.frameGroupsData = [
						{
							type: 0, // Idle
							width: initialItem.width,
							height: initialItem.height,
							layers: initialItem.layers,
							frames: initialItem.frames,
							patternX: initialItem.patternX,
							patternY: initialItem.patternY,
							patternZ: initialItem.patternZ,
							exactSize: initialItem.exactSize,
							loopCount: initialItem.loopCount,
							startFrame: initialItem.startFrame,
							isAnimation: initialItem.isAnimation,
							animationMode: initialItem.animationMode,
							frameDurations: initialItem.frameDurations,
							spriteIndex: [...(initialItem.spriteIndex || [])]
						}
					];
				}

				// Default to Walking group (index 1) for outfits if available
				// This matches Object Builder behavior and ensures animation controller shows up
				if (initialItem.frameGroupsData && initialItem.frameGroupsData.length > 1) {
					initialGroup = 1;
					const group = initialItem.frameGroupsData[1];
					initialItem = {
						...initialItem,
						width: group.width,
						height: group.height,
						frames: group.frames,
						layers: group.layers,
						patternX: group.patternX,
						patternY: group.patternY,
						patternZ: group.patternZ,
						exactSize: group.exactSize,
						spriteIndex: group.spriteIndex,
						isAnimation: group.isAnimation,
						loopCount: group.loopCount || 0,
						startFrame: group.startFrame || 0,
						animationMode: group.animationMode || 0,
						frameDurations: group.frameDurations || []
					};
				} else if (initialItem.frameGroupsData && initialItem.frameGroupsData.length === 1) {
					// Load the first (and only) frame group
					const group = initialItem.frameGroupsData[0];
					initialItem = {
						...initialItem,
						width: group.width,
						height: group.height,
						frames: group.frames,
						layers: group.layers,
						patternX: group.patternX,
						patternY: group.patternY,
						patternZ: group.patternZ,
						exactSize: group.exactSize,
						spriteIndex: group.spriteIndex,
						isAnimation: group.isAnimation,
						loopCount: group.loopCount || 0,
						startFrame: group.startFrame || 0,
						animationMode: group.animationMode || 0,
						frameDurations: group.frameDurations || []
					};
				}
				// For version < 1057 (no frame groups), use top-level properties directly
			}

			console.log('PropertiesPanel draftItem set:', {
				updateCounter,
				id: initialItem.id,
				width: initialItem.width,
				frames: initialItem.frames,
				layers: initialItem.layers,
				height: initialItem.height,
				category: initialItem.category,
				patternX: initialItem.patternX,
				patternY: initialItem.patternY,
				patternZ: initialItem.patternZ,
				source: 'useEffect initialization',
				spriteIndexLength: initialItem.spriteIndex?.length,
				spriteIndexFirst20: initialItem.spriteIndex?.slice(0, 20)
			});

			setDraftItem(initialItem);
			setHasChanges(false);
			setSelectedFrameGroup(initialGroup);
			selectedFrameGroupRef.current = initialGroup;
			markUnsavedChanges(openedItemId, openedItemCategory, false);
			// Store original state for comparison and reset
			originalItemRef.current = { ...initialItem };
		} else {
			originalItemRef.current = null;
			setDraftItem(null);
			setHasChanges(false);
		}
	}, [item, openedItemId, openedItemCategory, updateCounter, markUnsavedChanges]);

	const handlePropertyChange = useCallback(
		(property: string, value: any) => {
			if (!draftItem || !openedItemId || !openedItemCategory) return;

			// Handle numeric conversions
			let finalValue = value;
			if (typeof (draftItem as any)[property] === 'number' && typeof value === 'string') {
				finalValue = Number(value);
			}

			setDraftItem((prev) => {
				if (!prev) return null;
				const newItem = { ...prev, [property]: finalValue };

				// Update frameGroupsData if it exists
				const currentFrameGroup = selectedFrameGroupRef.current;
				if (newItem.frameGroupsData && newItem.frameGroupsData[currentFrameGroup]) {
					// Update the specific group data
					const newGroups = [...newItem.frameGroupsData];
					newGroups[currentFrameGroup] = {
						...newGroups[currentFrameGroup],
						[property]: finalValue
					};
					newItem.frameGroupsData = newGroups;
				}
				return newItem;
			});
			setHasChanges(true);
			markUnsavedChanges(openedItemId, openedItemCategory, true);
		},
		[draftItem, openedItemId, openedItemCategory, markUnsavedChanges]
	);

	const handleSave = () => {
		if (!draftItem || !openedItemId || !hasChanges || !openedItemCategory) return;

		// Extract only the properties that exist in ThingType
		const updates: Partial<typeof item> = {};
		Object.keys(draftItem).forEach((key) => {
			if (item && (draftItem as any)[key] !== (item as any)[key]) {
				(updates as any)[key] = (draftItem as any)[key];
			}
		});

		updateThing(openedItemId, openedItemCategory, updates);
		setHasChanges(false);
		markUnsavedChanges(openedItemId, openedItemCategory, false);
	};

	const handleDiscardChanges = () => {
		if (!originalItemRef.current || !openedItemId || !openedItemCategory) return;

		// Reset to the original transformed state (not raw item)
		setDraftItem({ ...originalItemRef.current });
		setHasChanges(false);
		markUnsavedChanges(openedItemId, openedItemCategory, false);

		// Reset frame group selection to initial state for outfits
		if (originalItemRef.current.category === ThingCategory.OUTFIT) {
			const initialGroup = originalItemRef.current.frameGroupsData?.length > 1 ? 1 : 0;
			setSelectedFrameGroup(initialGroup);
			selectedFrameGroupRef.current = initialGroup;
		}
	};

	const hasPropertyChanged = (property: string): boolean => {
		if (!originalItemRef.current || !draftItem) return false;
		const original = (originalItemRef.current as any)[property];
		const current = (draftItem as any)[property];

		// Handle array comparison (like spriteIndex)
		if (Array.isArray(original) && Array.isArray(current)) {
			return JSON.stringify(original) !== JSON.stringify(current);
		}

		return original !== current;
	};

	const handleUndoProperty = (property: string) => {
		if (!originalItemRef.current || !draftItem || !openedItemId || !openedItemCategory) return;

		const originalValue = (originalItemRef.current as any)[property];
		setDraftItem((prev) => {
			if (!prev) return null;
			const updated = { ...prev, [property]: originalValue };

			// Check if there are any remaining changes after this update
			const stillHasChanges = Object.keys(updated).some((key) => {
				if (key === property) return false;
				const orig = (originalItemRef.current as any)?.[key];
				const curr = (updated as any)[key];

				// Handle array comparison
				if (Array.isArray(orig) && Array.isArray(curr)) {
					return JSON.stringify(orig) !== JSON.stringify(curr);
				}

				return orig !== curr;
			});

			setHasChanges(stillHasChanges);
			markUnsavedChanges(openedItemId, openedItemCategory, stillHasChanges);

			return updated;
		});
	};

	const PropertyWithUndo = ({ property, children }: { property: string; children: React.ReactNode }) => {
		const hasChanged = hasPropertyChanged(property);
		return (
			<div className="flex items-center gap-1">
				{hasChanged && (
					<Button
						size="icon"
						variant="ghost"
						title="Undo to original"
						onClick={() => handleUndoProperty(property)}
						className="h-5 w-5 p-0 hover:bg-primary/20 hover:text-primary"
					>
						<Undo2 className="h-2 w-2" />
					</Button>
				)}
				{children}
			</div>
		);
	};

	const handleClose = () => {
		// If there are unsaved changes, ask for confirmation
		if (hasChanges) {
			setShowCloseConfirm(true);
			return;
		}

		// No changes, close immediately and delete everything
		performClose();
	};

	const performClose = () => {
		if (!openedItemId || !openedItemCategory) return;

		// Delete the item's state from localStorage
		try {
			if (typeof window !== 'undefined') {
				const key = getItemStateKey(openedItemCategory, openedItemId);
				localStorage.removeItem(key);
			}
		} catch (e) {
			console.error('Failed to delete item state from localStorage:', e);
		}

		// Remove item from opened items list (this will also update localStorage)
		removeOpenedItem(openedItemId, openedItemCategory);

		setOpenedItemId(null);
		setDraftItem(null);
		setHasChanges(false);
		setShowCloseConfirm(false);
	};

	// Visibility helpers based on category and version (matching Object Builder logic)
	const clientVersion = data?.version.value || 0;
	// ALWAYS use openedItemCategory when an item is opened - don't let selectedCategory affect the properties panel
	const itemCategory = openedItemCategory || selectedCategory;
	const isItem = itemCategory === ThingCategory.ITEM;
	const isOutfit = itemCategory === ThingCategory.OUTFIT;
	const isMissile = itemCategory === ThingCategory.MISSILE;

	// Frame groups are only supported for outfits in version >= 1057 (10.57)
	const supportsFrameGroups = clientVersion >= 1057;

	// Version-specific visibility checks
	const showPatternZ = clientVersion >= 755;
	const showGroundBorder = isItem && clientVersion >= 755;
	const showHangable = isItem && clientVersion >= 755;
	const showDontHide = isItem && clientVersion >= 780;
	const showIgnoreLook = isItem && clientVersion >= 780;
	const showHasCharges = isItem && clientVersion >= 780 && clientVersion <= 854;
	const showFloorChange = isItem && clientVersion >= 710 && clientVersion <= 854;
	const showTranslucent = isItem && clientVersion >= 860;
	const showEquipment = isItem && clientVersion >= 900;
	const showMarket = isItem && clientVersion >= 940;
	const showNoMoveAnimation = isItem && clientVersion >= 1010;
	const showDefaultActions = isItem && clientVersion >= 1021;
	const showUsable = isItem && clientVersion >= 1021;
	const showWrappable = isItem && clientVersion >= 1021;
	const showTopEffect = isItem && clientVersion >= 1021;
	const showAnimationProperties = clientVersion >= 1050;

	// Category-specific visibility checks
	const showPhysicsGround = isItem;
	const showMinimap = isItem;
	const showDisplacement = isItem || isOutfit;
	const showDisplacementElevation = isItem;
	const showLayerPosition = isItem;
	const showWriting = isItem;
	const showLensHelp = isItem;
	const showInteraction = isItem;
	const showHooks = isItem;
	const showAnimateAlways = isOutfit;

	const [zoom, setZoom] = useState(1);
	const [panX, setPanX] = useState(0);
	const [panY, setPanY] = useState(0);
	const [showExactSize, setShowExactSize] = useState(false);
	const [showGrid, setShowGrid] = useState(false);
	const [isPanEnabled, setIsPanEnabled] = useState(false);
	const [isMiddleMousePanning, setIsMiddleMousePanning] = useState(false);
	const [showDirectionButtons, setShowDirectionButtons] = useState(true);

	// Pattern and frame state for rendering
	const [patternX, setPatternX] = useState(0);
	const [patternY, setPatternY] = useState(0);
	const [patternZ, setPatternZ] = useState(0);
	const [currentFrame, setCurrentFrame] = useState(0);
	const [currentLayer, setCurrentLayer] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);

	// Outfit data state (for outfit colorization and addons)
	const [outfitData, setOutfitData] = useState({
		head: 0,
		body: 0,
		legs: 0,
		feet: 0,
		addons: [false, false] // [addon1, addon2]
	});

	// Scene preview state (for outfit scene background)
	const [showScene, setShowScene] = useState(false);
	const [showSmooth, setShowSmooth] = useState(false);
	const [defaultSceneTiles, setDefaultSceneTiles] = useState<null | SceneTile[][]>(null);
	const [sceneSize, setSceneSize] = useState({ width: 0, height: 0 });
	const [sceneScrollOffset, setSceneScrollOffset] = useState(0);
	const sceneScrollRef = useRef(0);

	// Load default scene when showScene is enabled
	useEffect(() => {
		if (showScene && !defaultSceneTiles) {
			loadDefaultScene();
		}
	}, [showScene]);

	const loadDefaultScene = async () => {
		try {
			const config = await invoke<{ default_scene?: string }>('get_config');
			if (config.default_scene) {
				const content = await invoke<string>('load_scene', { name: config.default_scene });
				const scene = JSON.parse(content);
				setDefaultSceneTiles(scene.tiles);
				setSceneSize({ width: scene.width, height: scene.height });
			} else {
				// Load public default scene if no configured default exists
				try {
					const response = await fetch('/default-scene.json');
					if (response.ok) {
						const scene = await response.json();
						if (scene.tiles && scene.width && scene.height) {
							setDefaultSceneTiles(scene.tiles);
							setSceneSize({ width: scene.width, height: scene.height });
						}
					}
				} catch (fetchError) {
					console.error('Failed to load public default scene:', fetchError);
				}
			}
		} catch (e) {
			console.error('Failed to load default scene:', e);
		}
	};

	const handleFrameGroupChange = (index: number) => {
		setSelectedFrameGroup(index);
		selectedFrameGroupRef.current = index;
		if (draftItem && draftItem.frameGroupsData) {
			const group = draftItem.frameGroupsData[index];
			if (group) {
				setDraftItem((prev) => ({
					...prev!,
					width: group.width,
					height: group.height,
					frames: group.frames,
					layers: group.layers,
					patternX: group.patternX,
					patternY: group.patternY,
					patternZ: group.patternZ,
					exactSize: group.exactSize,
					spriteIndex: group.spriteIndex,
					isAnimation: group.isAnimation,
					loopCount: group.loopCount || 0,
					startFrame: group.startFrame || 0,
					animationMode: group.animationMode || 0,
					frameDurations: group.frameDurations || []
				}));
				// Reset current frame to 0 to avoid out of bounds
				setCurrentFrame(0);
			}
		}
	};

	const handleCreateFrameGroup = () => {
		if (!draftItem || !isOutfit) return;

		const currentGroups = draftItem.frameGroupsData || [];
		if (currentGroups.length >= 2) return; // Maximum 2 frame groups

		// Determine new group type (Walking=1, Idle=0)
		// If we have no groups, default to Idle (0)
		// If we have one group, check its type and pick the other one
		let type = 0;
		if (currentGroups.length > 0) {
			const existingType = currentGroups[0].type;
			type = existingType === 0 ? 1 : 0;
		}

		// Default values matching Object Builder behavior
		const width = 1;
		const height = 1;
		const exactSize = 32;
		const layers = 1;
		const patternX = 4; // 4 directions
		const patternY = 1;
		const patternZ = 1;
		const frames = type === 1 ? 3 : 1; // 3 frames for walking (type 1), 1 for idle (type 0)

		// Initialize empty sprites (ID 0)
		const totalSprites = width * height * layers * patternX * patternY * patternZ * frames;
		const spriteIndex = new Array(totalSprites).fill(0);

		// Create new frame group with defaults
		const newGroup = {
			type,
			width,
			height,
			layers,
			frames,
			patternX,
			patternY,
			patternZ,
			exactSize,
			spriteIndex,
			loopCount: 0,
			startFrame: 0,
			animationMode: 0, // Asynchronous
			frameDurations: [],
			isAnimation: frames > 1
		};

		const newGroups = [...currentGroups, newGroup];
		const newIndex = newGroups.length - 1;

		setDraftItem((prev) => ({
			...prev!,
			width: newGroup.width,
			height: newGroup.height,
			frames: newGroup.frames,
			layers: newGroup.layers,
			frameGroupsData: newGroups,
			patternX: newGroup.patternX,
			patternY: newGroup.patternY,
			patternZ: newGroup.patternZ,
			exactSize: newGroup.exactSize,
			spriteIndex: newGroup.spriteIndex,
			isAnimation: newGroup.isAnimation,
			loopCount: newGroup.loopCount || 0,
			startFrame: newGroup.startFrame || 0,
			animationMode: newGroup.animationMode || 0,
			frameDurations: newGroup.frameDurations || []
		}));

		setSelectedFrameGroup(newIndex);
		selectedFrameGroupRef.current = newIndex;
		setCurrentFrame(0);
		setHasChanges(true);
		if (openedItemId && openedItemCategory) {
			markUnsavedChanges(openedItemId, openedItemCategory, true);
		}
	};

	const handleDeleteFrameGroup = () => {
		if (!draftItem || !isOutfit) return;

		const currentGroups = draftItem.frameGroupsData || [];
		if (currentGroups.length <= 1) return; // Must keep at least 1 frame group

		const newGroups = currentGroups.filter((_, idx) => idx !== selectedFrameGroup);
		const newIndex = Math.min(selectedFrameGroup, newGroups.length - 1);
		const group = newGroups[newIndex];

		setDraftItem((prev) => ({
			...prev!,
			width: group.width,
			height: group.height,
			frames: group.frames,
			layers: group.layers,
			patternX: group.patternX,
			patternY: group.patternY,
			patternZ: group.patternZ,
			frameGroupsData: newGroups,
			exactSize: group.exactSize,
			spriteIndex: group.spriteIndex,
			isAnimation: group.isAnimation,
			loopCount: group.loopCount || 0,
			startFrame: group.startFrame || 0,
			animationMode: group.animationMode || 0,
			frameDurations: group.frameDurations || []
		}));

		setSelectedFrameGroup(newIndex);
		selectedFrameGroupRef.current = newIndex;
		setCurrentFrame(0);
		setHasChanges(true);
		if (openedItemId && openedItemCategory) {
			markUnsavedChanges(openedItemId, openedItemCategory, true);
		}
	};

	const zoomLevels = [1, 2, 4, 8];

	const handleZoomIn = () => {
		const currentIndex = zoomLevels.indexOf(zoom);
		if (currentIndex < zoomLevels.length - 1) {
			setZoom(zoomLevels[currentIndex + 1]);
		}
	};

	const handleZoomOut = () => {
		const currentIndex = zoomLevels.indexOf(zoom);
		if (currentIndex > 0) {
			setZoom(zoomLevels[currentIndex - 1]);
		}
	};

	const handleResetPan = () => {
		setPanX(0);
		setPanY(0);
	};

	const handleResetSprites = () => {
		if (!item || !draftItem) return;

		// For outfits with frameGroupsData, get sprites from the correct frame group
		if (item.category === ThingCategory.OUTFIT && item.frameGroupsData) {
			const currentGroupIndex = selectedFrameGroupRef.current;
			const originalGroup = item.frameGroupsData[currentGroupIndex];
			if (originalGroup) {
				handlePropertyChange('spriteIndex', [...originalGroup.spriteIndex]);
				return;
			}
		}

		// Fallback for non-outfit items
		handlePropertyChange('spriteIndex', [...item.spriteIndex]);
	};

	const [hoveredSpriteId, setHoveredSpriteId] = useState<null | number>(null);

	const handleSpriteDoubleClick = useCallback(
		(spriteId: number) => {
			setHighlightedSpriteId(spriteId);
		},
		[setHighlightedSpriteId]
	);

	const handleSpriteDrop = useCallback(
		(index: number, spriteId: number | number[]) => {
			if (draftItem && draftItem.spriteIndex) {
				const newSpriteIndex = [...draftItem.spriteIndex];

				if (Array.isArray(spriteId)) {
					// Multi-drop: fill sequentially
					for (let i = 0; i < spriteId.length; i++) {
						const targetIndex = index + i;
						if (targetIndex < newSpriteIndex.length) {
							newSpriteIndex[targetIndex] = spriteId[i];
						}
					}
				} else {
					// Single drop
					if (index >= 0 && index < newSpriteIndex.length) {
						newSpriteIndex[index] = spriteId;
					}
				}

				handlePropertyChange('spriteIndex', newSpriteIndex);
			}
		},
		[draftItem, handlePropertyChange]
	);
	const handleSpriteHover = (spriteId: null | number) => {
		setHoveredSpriteId(spriteId);
	};

	// Track if we've loaded state for current item
	const hasLoadedStateRef = useRef(false);
	// Track if we're currently loading state (prevents save effect from running during load)
	const isLoadingStateRef = useRef(false);
	// Track previous item to save its state when switching
	const previousItemRef = useRef<null | { id: number; category: ThingCategory }>(null);
	// Use refs to track current state values so we can capture them reliably when switching items
	const stateRefs = useRef({
		zoom: 1,
		panX: 0,
		panY: 0,
		patternX: 0,
		patternY: 0,
		patternZ: 0,
		currentFrame: 0,
		currentLayer: 0,
		showGrid: false,
		isPlaying: false,
		showExactSize: false,
		outfitData: { head: 0, body: 0, legs: 0, feet: 0, addons: [false, false] }
	});

	// Keep refs in sync with state
	useEffect(() => {
		stateRefs.current.zoom = zoom;
		stateRefs.current.panX = panX;
		stateRefs.current.panY = panY;
		stateRefs.current.patternX = patternX;
		stateRefs.current.patternY = patternY;
		stateRefs.current.patternZ = patternZ;
		stateRefs.current.currentFrame = currentFrame;
		stateRefs.current.currentLayer = currentLayer;
		stateRefs.current.isPlaying = isPlaying;
		stateRefs.current.showExactSize = showExactSize;
		stateRefs.current.showGrid = showGrid;
		stateRefs.current.outfitData = outfitData;
	}, [
		zoom,
		panX,
		panY,
		patternX,
		patternY,
		patternZ,
		currentFrame,
		currentLayer,
		isPlaying,
		showExactSize,
		showGrid,
		outfitData
	]);

	// Animation loop
	// Animation Logic - Re-implementing Object Builder Logic
	// Reference: ThingDataView.as and Animator.as

	const animationState = useRef({
		lastTime: 0,
		timeRemaining: 0,
		skipFirstFrame: false,
		durations: [] as number[]
	});

	const requestRef = useRef<number>();

	const animate = (time: number) => {
		if (!isPlaying || !draftItem) return;

		const state = animationState.current;

		// Initialize lastTime if needed
		if (state.lastTime === 0) {
			state.lastTime = time;
			requestRef.current = requestAnimationFrame(animate);
			return;
		}

		const elapsed = time - state.lastTime;
		state.lastTime = time;

		// Update scene scroll when scene is visible (smooth scrolling at ~60fps)
		if (showScene && defaultSceneTiles) {
			// Scroll speed: ~1 pixel per frame at 60fps = ~60 pixels per second
			// Slower speed to better match outfit walking animation
			const scrollSpeed = elapsed * 0.06; // pixels per millisecond
			sceneScrollRef.current += scrollSpeed;
			setSceneScrollOffset(Math.floor(sceneScrollRef.current));
		}

		if (state.durations.length === 0) return;

		// Logic from Animator.as update()
		if (elapsed >= state.timeRemaining) {
			// Advance frame
			setCurrentFrame((prevFrame) => {
				const frames = draftItem.frames;
				let nextFrame = prevFrame + 1;

				// Loop logic
				if (nextFrame >= frames) {
					nextFrame = 0;
				}

				// Skip first frame logic (Animator.as line 144)
				// m_currentFrame = skipFirstFrame && frame == 0 ? 1 % frames : frame;
				if (state.skipFirstFrame && nextFrame === 0) {
					nextFrame = 1 % frames;
				}

				// Update duration for the new frame
				// Animator.as line 137: var duration:int = this.durations[frame].duration - (elapsed - m_currentFrameDuration);
				// We simplify this by just setting the new duration, but subtracting the overshoot would be more precise.
				// For now, let's just set the new duration to avoid drift issues in JS.
				const nextDuration = state.durations[nextFrame] || 200;
				state.timeRemaining = nextDuration - (elapsed - state.timeRemaining);

				// Clamp to 0
				if (state.timeRemaining < 0) state.timeRemaining = 0;

				return nextFrame;
			});
		} else {
			state.timeRemaining -= elapsed;
		}

		requestRef.current = requestAnimationFrame(animate);
	};

	useEffect(() => {
		if (isPlaying && draftItem) {
			// 1. Setup Durations (ThingDataView.as setThingData)
			const currentGroup = draftItem.frameGroupsData?.[selectedFrameGroupRef.current];

			// Get base durations
			let durations: number[] = [];

			// Use durations from the current frame group if available
			const groupDurations = currentGroup?.frameDurations;
			if (groupDurations && groupDurations.length > 0) {
				durations = groupDurations.map((d) => d.minimum);
			} else if (draftItem.frameDurations && draftItem.frameDurations.length > 0) {
				// Fallback to item-level durations (usually same as group 0)
				durations = draftItem.frameDurations.map((d) => d.minimum);
			} else {
				// Fallback defaults if no duration data is available
				// Matches Object Builder ObjectBuilderSettings.as defaults
				let defaultDuration = 500; // Item default
				if (draftItem.category === ThingCategory.OUTFIT) {
					defaultDuration = 300;
				} else if (draftItem.category === ThingCategory.EFFECT) {
					defaultDuration = 100; // Object Builder uses 100ms for effects
				} else if (draftItem.category === ThingCategory.MISSILE) {
					defaultDuration = 150;
				}
				durations = new Array(draftItem.frames).fill(defaultDuration);
			}

			// Object Builder Override Logic (ThingDataView.as lines 239-244)
			// "if(durations && frameGroup.type == FrameGroupType.WALKING && frameGroup.frames > 2)"
			// The 1000/frames override ONLY applies for actual WALKING frame groups (type 1)
			// NOT for simulated walking on Idle/Default groups (older versions like 8.60)
			const isOutfit = draftItem.category === ThingCategory.OUTFIT;
			const isGroupWalking = currentGroup?.type === 1;

			// Only apply the walking duration override for actual WALKING frame groups
			if (isGroupWalking && draftItem.frames > 2) {
				const calculatedDuration = Math.floor(1000 / draftItem.frames);
				durations = durations.map(() => calculatedDuration);
			}

			// Sanity check: Ensure no duration is 0 or too small
			durations = durations.map((d) => Math.max(d, 50));

			console.log('[AnimDebug] Setup', {
				durations,
				isGroupWalking,
				frames: draftItem.frames,
				category: draftItem.category,
				groupDurationsLen: groupDurations?.length,
				itemDurationsLen: draftItem.frameDurations?.length
			});

			// Setup Animator State
			animationState.current.durations = durations;

			// Skip First Frame Logic (ThingDataView.as line 248)
			// _animator.skipFirstFrame = (thingData.category == ThingCategory.OUTFIT && !thingData.thing.animateAlways && frameGroup.type != FrameGroupType.WALKING);
			const animateAlways = draftItem.animateAlways;
			const isIdle = currentGroup?.type !== 1; // Not walking

			animationState.current.skipFirstFrame = isOutfit && !animateAlways && isIdle;

			// Initialize time remaining for current frame if starting fresh
			if (animationState.current.timeRemaining <= 0) {
				animationState.current.timeRemaining = durations[currentFrame] || 200;
			}

			// Start Loop
			animationState.current.lastTime = 0; // Reset time
			requestRef.current = requestAnimationFrame(animate);
		} else {
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
		}

		return () => {
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
		};
	}, [isPlaying, draftItem, data, selectedFrameGroup]);

	// Direction handlers for outfits
	// Arrow buttons control direction (patternX):
	// Up = North, Down = South, Left = West, Right = East
	// Tibia directions: 0=East, 1=North, 2=South, 3=West

	const handlePatternUp = () => {
		// Up arrow = North (patternX = 0) - SWAPPED
		setPatternX(0);
	};

	const handlePatternDown = () => {
		// Down arrow = South (patternX = 2)
		if (item && item.patternX >= 3) {
			setPatternX(2);
		}
	};

	const handlePatternLeft = () => {
		// Left arrow = West (patternX = 3)
		if (item && item.patternX >= 4) {
			setPatternX(3);
		}
	};

	const handlePatternRight = () => {
		// Right arrow = East (patternX = 1) - SWAPPED
		if (item && item.patternX >= 2) {
			setPatternX(1);
		}
	};

	// Frame navigation handlers
	const handleFirstFrame = () => {
		setCurrentFrame(0);
	};

	const handlePrevFrame = () => {
		if (currentFrame > 0) {
			setCurrentFrame(currentFrame - 1);
		}
	};

	const handleNextFrame = () => {
		if (draftItem && currentFrame < draftItem.frames - 1) {
			setCurrentFrame(currentFrame + 1);
		}
	};

	const handleLastFrame = () => {
		if (draftItem) {
			setCurrentFrame(draftItem.frames - 1);
		}
	};

	const handlePlayPause = () => {
		if (!isPlaying) {
			// Starting animation - check if we need to skip first frame for outfits
			if (isOutfit && draftItem && !draftItem.animateAlways && currentFrame === 0 && draftItem.frames > 1) {
				setCurrentFrame(1);
			}
			setIsPlaying(true);
		} else {
			// Pausing animation - for outfits, return to idle frame (frame 0)
			setIsPlaying(false);
			if (isOutfit) {
				setCurrentFrame(0);
			}
			// Reset scene scroll when stopping
			sceneScrollRef.current = 0;
			setSceneScrollOffset(0);
		}
	};

	const handleRandomizeColors = () => {
		setOutfitData({
			...outfitData,
			head: Math.floor(Math.random() * 256), // 0-255
			body: Math.floor(Math.random() * 256),
			legs: Math.floor(Math.random() * 256),
			feet: Math.floor(Math.random() * 256)
		});
	};

	// Load saved state when item changes
	useEffect(() => {
		if (draftItem && openedItemId && openedItemCategory) {
			// Save previous item's state before loading new item (use refs to get reliable values)
			if (
				previousItemRef.current &&
				(previousItemRef.current.id !== openedItemId || previousItemRef.current.category !== openedItemCategory) &&
				hasLoadedStateRef.current
			) {
				// Use refs to capture state values reliably (these are from the previous item)
				const prevState: ItemPropertiesState = {
					zoom: stateRefs.current.zoom,
					panX: stateRefs.current.panX,
					panY: stateRefs.current.panY,
					patternX: stateRefs.current.patternX,
					patternY: stateRefs.current.patternY,
					patternZ: stateRefs.current.patternZ,
					showGrid: stateRefs.current.showGrid,
					isPlaying: stateRefs.current.isPlaying,
					currentFrame: stateRefs.current.currentFrame,
					currentLayer: stateRefs.current.currentLayer,
					showExactSize: stateRefs.current.showExactSize,
					outfitData: { ...stateRefs.current.outfitData } // Deep copy for outfitData
				};
				saveItemState(previousItemRef.current.category, previousItemRef.current.id, prevState);
			}

			// Reset the loaded flag BEFORE loading new state (prevents saving during transition)
			hasLoadedStateRef.current = false;
			// Set loading flag to prevent save effect from running
			isLoadingStateRef.current = true;

			// Load the saved state for THIS SPECIFIC item (using the exact ID and category)
			const savedState = loadItemState(openedItemCategory, openedItemId);

			// ALWAYS set ALL properties - use saved state if available, otherwise use defaults
			// This ensures no state leaks from previous items
			const zoomValue = savedState?.zoom !== undefined ? savedState.zoom : 1;
			const panXValue = savedState?.panX !== undefined ? savedState.panX : 0;
			const panYValue = savedState?.panY !== undefined ? savedState.panY : 0;

			// Pattern values with defaults based on item type
			// Use openedItemCategory directly (not itemCategory which depends on selectedCategory)
			let patternXValue = savedState?.patternX !== undefined ? savedState.patternX : 0;
			let patternYValue = savedState?.patternY !== undefined ? savedState.patternY : 0;
			if (!savedState) {
				// Set defaults based on opened item's category if no saved state
				if (openedItemCategory === ThingCategory.MISSILE) {
					patternXValue = 1;
					patternYValue = 2;
				} else if (openedItemCategory === ThingCategory.OUTFIT) {
					patternXValue = 2;
					patternYValue = 0;
				}
			}
			// Validate against item limits
			patternXValue = Math.min(patternXValue, Math.max(0, draftItem.patternX - 1));
			patternYValue = Math.min(patternYValue, Math.max(0, draftItem.patternY - 1));
			const patternZValue =
				savedState?.patternZ !== undefined ? Math.min(savedState.patternZ, Math.max(0, draftItem.patternZ - 1)) : 0;

			const currentFrameValue =
				savedState?.currentFrame !== undefined ? Math.min(savedState.currentFrame, Math.max(0, draftItem.frames - 1)) : 0;
			const currentLayerValue =
				savedState?.currentLayer !== undefined ? Math.min(savedState.currentLayer, Math.max(0, draftItem.layers - 1)) : 0;
			const isPlayingValue = savedState?.isPlaying !== undefined ? savedState.isPlaying : false;
			const showExactSizeValue = savedState?.showExactSize !== undefined ? savedState.showExactSize : false;
			const showGridValue = savedState?.showGrid !== undefined ? savedState.showGrid : false;

			// Outfit data
			let outfitDataValue;
			if (savedState?.outfitData) {
				outfitDataValue = { ...savedState.outfitData };
				// Ensure addons array matches item's patternY
				if (isOutfit && item) {
					const addonCount = Math.max(0, item.patternY - 1);
					if (!outfitDataValue.addons || outfitDataValue.addons.length !== addonCount) {
						outfitDataValue.addons = Array(addonCount).fill(false);
					} else {
						outfitDataValue.addons = outfitDataValue.addons.slice(0, addonCount);
					}
				}
			} else if (isOutfit && item) {
				const addonCount = Math.max(0, item.patternY - 1);
				outfitDataValue = {
					head: 0,
					body: 0,
					legs: 0,
					feet: 0,
					addons: Array(addonCount).fill(false)
				};
			} else {
				outfitDataValue = { head: 0, body: 0, legs: 0, feet: 0, addons: [false, false] };
			}

			// Set ALL state values explicitly (no conditional setting)
			setZoom(zoomValue);
			stateRefs.current.zoom = zoomValue;
			setPanX(panXValue);
			stateRefs.current.panX = panXValue;
			setPanY(panYValue);
			stateRefs.current.panY = panYValue;
			setPatternX(patternXValue);
			stateRefs.current.patternX = patternXValue;
			setPatternY(patternYValue);
			stateRefs.current.patternY = patternYValue;
			setPatternZ(patternZValue);
			stateRefs.current.patternZ = patternZValue;
			setCurrentFrame(currentFrameValue);
			stateRefs.current.currentFrame = currentFrameValue;
			setCurrentLayer(currentLayerValue);
			stateRefs.current.currentLayer = currentLayerValue;
			setIsPlaying(isPlayingValue);
			stateRefs.current.isPlaying = isPlayingValue;
			setShowExactSize(showExactSizeValue);
			stateRefs.current.showExactSize = showExactSizeValue;
			setShowGrid(showGridValue);
			stateRefs.current.showGrid = showGridValue;
			setOutfitData(outfitDataValue);
			stateRefs.current.outfitData = { ...outfitDataValue };

			// Update previous item ref immediately after loading completes
			previousItemRef.current = { id: openedItemId, category: openedItemCategory };
			hasLoadedStateRef.current = true;
			// Clear loading flag AFTER React completes its render cycle
			// This prevents the save effect from running immediately after loading
			// Using double requestAnimationFrame ensures all state updates are flushed
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					isLoadingStateRef.current = false;
				});
			});
		} else {
			hasLoadedStateRef.current = false;
			isLoadingStateRef.current = false;
			previousItemRef.current = null;
		}
	}, [draftItem, openedItemId, openedItemCategory, isOutfit, item]);

	// Save state whenever properties change (but only after state has been loaded and for current item)
	useEffect(() => {
		// Don't save if we're currently loading state (prevents overwriting during load)
		if (isLoadingStateRef.current) {
			return;
		}

		// CRITICAL: Only save if:
		// 1. We have a valid item
		// 2. State has been loaded (not during transition)
		// 3. previousItemRef matches current item (ensures we're saving for the right item)
		if (openedItemId && openedItemCategory && hasLoadedStateRef.current && draftItem) {
			// Double-check that we're saving for the correct item
			if (
				previousItemRef.current &&
				previousItemRef.current.id === openedItemId &&
				previousItemRef.current.category === openedItemCategory
			) {
				// Use current state values (refs are kept in sync)
				const state: ItemPropertiesState = {
					zoom,
					panX,
					panY,
					patternX,
					patternY,
					patternZ,
					showGrid,
					isPlaying,
					currentFrame,
					currentLayer,
					showExactSize,
					outfitData: { ...outfitData } // Deep copy
				};
				// Save with the EXACT item ID and category to ensure correct key
				saveItemState(openedItemCategory, openedItemId, state);
			}
		}
	}, [
		zoom,
		panX,
		panY,
		patternX,
		patternY,
		patternZ,
		currentFrame,
		currentLayer,
		isPlaying,
		showExactSize,
		showGrid,
		outfitData,
		openedItemId,
		openedItemCategory,
		draftItem
	]);

	// Load ALL sprites for the selected item (handles animated items correctly)
	useEffect(() => {
		if (!data || !item || !draftItem || !data.sprPath || !draftItem.spriteIndex) return;

		// Collect all unique sprite IDs used by this item
		const spriteIds = Array.from(new Set(draftItem.spriteIndex.filter((id) => id > 0)));

		if (spriteIds.length === 0) return;

		const loadItemSprites = async () => {
			try {
				const { loadSpriteIds } = await import('@/lib/tibia');
				// Load ALL sprites for this item (all frames, patterns, layers)
				await loadSpriteIds(data.sprPath!, spriteIds, data.transparency, data.sprites);
				notifySpritesLoaded();
			} catch (err) {
				console.error('Failed to load item sprites:', err);
			}
		};

		loadItemSprites();
	}, [data, item, draftItem, notifySpritesLoaded]);

	// Show empty state if no data loaded or no item selected
	if (!data || !item) {
		return (
			<div className="flex-1 bg-card rounded-lg shadow-island-lg flex flex-col overflow-hidden">
				<div className="h-8 px-4 flex items-center border-b border-border/50 bg-secondary/80">
					<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Object Properties</h2>
				</div>
				<div className="flex-1 flex items-center justify-center p-4">
					<div className="text-center text-muted-foreground">
						<FileQuestion className="h-16 w-16 mx-auto mb-3 opacity-50" />
						<p className="text-sm font-medium">
							No{' '}
							{itemCategory === ThingCategory.ITEM
								? 'item'
								: itemCategory === ThingCategory.OUTFIT
									? 'outfit'
									: itemCategory === ThingCategory.EFFECT
										? 'effect'
										: 'missile'}{' '}
							selected
						</p>
						<p className="text-xs mt-1">
							Select a{' '}
							{itemCategory === ThingCategory.ITEM
								? 'item'
								: itemCategory === ThingCategory.OUTFIT
									? 'outfit'
									: itemCategory === ThingCategory.EFFECT
										? 'effect'
										: 'missile'}{' '}
							from the list to view properties
						</p>
					</div>
				</div>
			</div>
		);
	}

	const firstSpriteId = draftItem && draftItem.spriteIndex && draftItem.spriteIndex.length > 0 ? draftItem.spriteIndex[0] : 0;

	// Wait for draft to be initialized
	if (!draftItem) {
		return (
			<div className="flex-1 bg-card rounded-lg shadow-island-lg flex flex-col overflow-hidden">
				<div className="h-8 px-4 flex items-center border-b border-border/50 bg-secondary/80">
					<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Object Properties</h2>
				</div>
				<div className="flex-1 flex items-center justify-center p-4">
					<div className="text-center text-muted-foreground">
						<FileQuestion className="h-16 w-16 mx-auto mb-3 opacity-50" />
						<p className="text-sm font-medium">
							No{' '}
							{itemCategory === ThingCategory.ITEM
								? 'item'
								: itemCategory === ThingCategory.OUTFIT
									? 'outfit'
									: itemCategory === ThingCategory.EFFECT
										? 'effect'
										: 'missile'}{' '}
							selected
						</p>
						<p className="text-xs mt-1">
							Select a{' '}
							{itemCategory === ThingCategory.ITEM
								? 'item'
								: itemCategory === ThingCategory.OUTFIT
									? 'outfit'
									: itemCategory === ThingCategory.EFFECT
										? 'effect'
										: 'missile'}{' '}
							from the list to view properties
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 bg-card rounded-lg shadow-island-lg flex flex-col overflow-hidden">
			<div className="h-8 px-4 flex items-center border-b border-border/50 bg-secondary/80">
				<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">
					{itemCategory === ThingCategory.ITEM
						? 'Object'
						: itemCategory === ThingCategory.OUTFIT
							? 'Outfit'
							: itemCategory === ThingCategory.EFFECT
								? 'Effect'
								: 'Missile'}{' '}
					Properties - ID {draftItem.id}
					{draftItem.isMarketItem && draftItem.marketName && ` - ${draftItem.marketName}`}
				</h2>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-4">
					<div
						className={`grid gap-4 mb-4 grid-cols-1 min-[820px]:grid-cols-[361px_1fr] ${isOutfit ? '' : 'min-[1400px]:grid-cols-[361px_1fr_1fr]'}`}
					>
						<div className="w-full max-w-[361px] mx-auto min-[820px]:w-[361px] min-[820px]:max-w-none flex flex-col h-full">
							<div className="flex flex-col items-center justify-between space-y-4 flex-1">
								<div className="relative w-full flex-1">
									{/* Size badge - Top Left */}
									<div className="absolute top-2 left-2 z-10 bg-secondary/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-muted-foreground font-mono border border-border/50 shadow-lg">
										{draftItem.width * draftItem.exactSize}x{draftItem.height * draftItem.exactSize}
									</div>

									{/* Hovered Sprite ID Badge */}
									{hoveredSpriteId !== null && (
										<div className="absolute bottom-2 right-2 z-10 bg-secondary/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-muted-foreground font-mono border border-border/50 shadow-lg">
											Sprite: {hoveredSpriteId}
										</div>
									)}

									{/* Pattern controls - Top Center (Outfits only) */}
									{itemCategory === ThingCategory.OUTFIT && (
										<div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
											<Button
												size="icon"
												title="North"
												variant="ghost"
												disabled={!item}
												onClick={handlePatternUp}
												className="h-6 w-6 hover:bg-primary/20 hover:text-primary transition-colors p-0"
											>
												<ChevronUp className="h-3 w-3" />
											</Button>
											<Button
												size="icon"
												title="East"
												variant="ghost"
												onClick={handlePatternRight}
												disabled={!item || item.patternX < 2}
												className="h-6 w-6 hover:bg-primary/20 hover:text-primary transition-colors p-0"
											>
												<ChevronRight className="h-3 w-3" />
											</Button>
											<Button
												size="icon"
												title="South"
												variant="ghost"
												onClick={handlePatternDown}
												disabled={!item || item.patternX < 3}
												className="h-6 w-6 hover:bg-primary/20 hover:text-primary transition-colors p-0"
											>
												<ChevronDown className="h-3 w-3" />
											</Button>
											<Button
												size="icon"
												title="West"
												variant="ghost"
												onClick={handlePatternLeft}
												disabled={!item || item.patternX < 4}
												className="h-6 w-6 hover:bg-primary/20 hover:text-primary transition-colors p-0"
											>
												<ChevronLeft className="h-3 w-3" />
											</Button>
										</div>
									)}

									{/* Missile Directional Controls - Overlay on Canvas */}
									{itemCategory === ThingCategory.MISSILE && showDirectionButtons && (
										<div className="absolute inset-0 z-10 pointer-events-none">
											{/* Top Row */}
											<div className="absolute top-[15%] left-1/2 -translate-x-1/2 flex gap-3 pointer-events-auto">
												<Button
													size="icon"
													variant="ghost"
													onClick={() => {
														setPatternX(0);
														setPatternY(0);
													}}
													className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
												>
													<ArrowUpLeft className="h-4 w-4 text-muted-foreground" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													onClick={() => {
														setPatternX(1);
														setPatternY(0);
													}}
													className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
												>
													<ArrowUp className="h-4 w-4 text-muted-foreground" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													onClick={() => {
														setPatternX(2);
														setPatternY(0);
													}}
													className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
												>
													<ArrowUpRight className="h-4 w-4 text-muted-foreground" />
												</Button>
											</div>

											{/* Middle Row */}
											<div className="absolute top-1/2 -translate-y-1/2 left-[15%] flex flex-col gap-1 pointer-events-auto">
												<Button
													size="icon"
													variant="ghost"
													onClick={() => {
														setPatternX(0);
														setPatternY(1);
													}}
													className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
												>
													<ArrowLeft className="h-4 w-4 text-muted-foreground" />
												</Button>
											</div>
											<div className="absolute top-1/2 -translate-y-1/2 right-[15%] flex flex-col gap-1 pointer-events-auto">
												<Button
													size="icon"
													variant="ghost"
													onClick={() => {
														setPatternX(2);
														setPatternY(1);
													}}
													className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
												>
													<ArrowRight className="h-4 w-4 text-muted-foreground" />
												</Button>
											</div>

											{/* Bottom Row */}
											<div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 flex gap-3 pointer-events-auto">
												<Button
													size="icon"
													variant="ghost"
													onClick={() => {
														setPatternX(0);
														setPatternY(2);
													}}
													className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
												>
													<ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													onClick={() => {
														setPatternX(1);
														setPatternY(2);
													}}
													className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
												>
													<ArrowDown className="h-4 w-4 text-muted-foreground" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													onClick={() => {
														setPatternX(2);
														setPatternY(2);
													}}
													className="h-8 w-8 p-0 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-full"
												>
													<ArrowDownRight className="h-4 w-4 text-muted-foreground" />
												</Button>
											</div>
										</div>
									)}

									{/* Direction buttons toggle - Left of zoom controls (Only for missiles) */}
									{itemCategory === ThingCategory.MISSILE && (
										<div className="absolute top-2 right-[2.85rem] z-10 flex flex-col items-end gap-1">
											<div className="flex flex-col items-center bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
												<Button
													size="icon"
													variant={showDirectionButtons ? 'secondary' : 'ghost'}
													onClick={() => setShowDirectionButtons(!showDirectionButtons)}
													title={showDirectionButtons ? 'Hide direction buttons' : 'Show direction buttons'}
													className={cn(
														'h-6 w-6 p-0',
														showDirectionButtons ? 'bg-primary/20 hover:bg-primary/30' : 'hover:bg-secondary/50'
													)}
												>
													<Compass className="h-3 w-3 text-muted-foreground" />
												</Button>
											</div>
										</div>
									)}

									{/* Zoom controls - Top Right (Vertical) */}
									<div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
										<div className="flex flex-col items-center gap-0.5 bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
											<Button
												size="icon"
												variant="ghost"
												onClick={handleZoomIn}
												className="h-6 w-6 hover:bg-secondary/50 p-0"
												disabled={zoom === zoomLevels[zoomLevels.length - 1]}
											>
												<ZoomIn className="h-3 w-3 text-muted-foreground" />
											</Button>
											<div className="px-1 text-[10px] font-mono text-foreground min-w-[1.5rem] text-center">{zoom}x</div>
											<Button
												size="icon"
												variant="ghost"
												onClick={handleZoomOut}
												disabled={zoom === zoomLevels[0]}
												className="h-6 w-6 hover:bg-secondary/50 p-0"
											>
												<ZoomOut className="h-3 w-3 text-muted-foreground" />
											</Button>
										</div>

										<div className="flex flex-col gap-1 bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
											<Button
												size="icon"
												variant="ghost"
												title="Reset center"
												onClick={handleResetPan}
												className="h-6 w-6 hover:bg-secondary/50 p-0"
											>
												<RotateCcw className="h-3 w-3 text-muted-foreground" />
											</Button>
											<Button
												size="icon"
												onClick={() => setIsPanEnabled(!isPanEnabled)}
												title={isPanEnabled ? 'Disable Pan' : 'Enable Pan'}
												variant={isPanEnabled || isMiddleMousePanning ? 'secondary' : 'ghost'}
												className={cn(
													'h-6 w-6 p-0',
													isPanEnabled || isMiddleMousePanning ? 'bg-primary/20 hover:bg-primary/30' : 'hover:bg-secondary/50'
												)}
											>
												<Move className="h-3 w-3 text-muted-foreground" />
											</Button>
										</div>

										<div className="flex flex-col gap-1 bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
											<Button
												size="icon"
												variant="ghost"
												title="Reset Sprites"
												onClick={handleResetSprites}
												className="h-6 w-6 hover:bg-secondary/50 p-0"
											>
												<Undo2 className="h-3 w-3 text-muted-foreground" />
											</Button>
										</div>
										<div className="flex flex-col gap-1 bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
											{isOutfit && (
												<Button
													size="icon"
													onClick={() => setShowScene(!showScene)}
													variant={showScene ? 'secondary' : 'ghost'}
													title={showScene ? 'Hide Scene' : 'Show Scene'}
													className={cn('h-6 w-6 p-0', showScene ? 'bg-primary/20 hover:bg-primary/30' : 'hover:bg-secondary/50')}
												>
													<TreePine className="h-3 w-3 text-muted-foreground" />
												</Button>
											)}
											<Button
												size="icon"
												onClick={() => setShowSmooth(!showSmooth)}
												variant={showSmooth ? 'secondary' : 'ghost'}
												title={showSmooth ? 'Disable Smoothing' : 'Enable Smoothing'}
												className={cn('h-6 w-6 p-0', showSmooth ? 'bg-primary/20 hover:bg-primary/30' : 'hover:bg-secondary/50')}
											>
												<Blend className="h-3 w-3 text-muted-foreground" />
											</Button>
										</div>
									</div>

									{/* Sprite Canvas */}
									<CheckerBoard className="w-full h-full border border-border/50 rounded-lg flex items-center justify-center overflow-hidden">
										{firstSpriteId > 0 ? (
											<SpriteCanvas
												showEmpty
												panX={panX}
												panY={panY}
												scale={zoom}
												allowFileDrop
												thing={draftItem}
												patternX={patternX}
												patternY={patternY}
												patternZ={patternZ}
												showGrid={showGrid}
												smooth={showSmooth}
												frame={currentFrame}
												layer={currentLayer}
												isPanEnabled={isPanEnabled}
												sceneWidth={sceneSize.width}
												showExactSize={showExactSize}
												sceneHeight={sceneSize.height}
												onSpriteDrop={handleSpriteDrop}
												onSpriteHover={handleSpriteHover}
												sceneScrollOffset={sceneScrollOffset}
												onSpriteDoubleClick={handleSpriteDoubleClick}
												outfitData={isOutfit ? outfitData : undefined}
												onMiddleMousePanChange={setIsMiddleMousePanning}
												sceneTiles={showScene ? defaultSceneTiles : undefined}
												renderMode={isMissile || isOutfit ? 'preview' : 'full'}
												onPanChange={(x, y) => {
													setPanX(x);
													setPanY(y);
												}}
											/>
										) : (
											<SpriteCanvas
												showEmpty
												panX={panX}
												panY={panY}
												scale={zoom}
												allowFileDrop
												thing={draftItem}
												patternX={patternX}
												patternY={patternY}
												patternZ={patternZ}
												showGrid={showGrid}
												smooth={showSmooth}
												frame={currentFrame}
												layer={currentLayer}
												isPanEnabled={isPanEnabled}
												sceneWidth={sceneSize.width}
												showExactSize={showExactSize}
												sceneHeight={sceneSize.height}
												onSpriteDrop={handleSpriteDrop}
												onSpriteHover={handleSpriteHover}
												sceneScrollOffset={sceneScrollOffset}
												onSpriteDoubleClick={handleSpriteDoubleClick}
												outfitData={isOutfit ? outfitData : undefined}
												onMiddleMousePanChange={setIsMiddleMousePanning}
												sceneTiles={showScene ? defaultSceneTiles : undefined}
												renderMode={isMissile || isOutfit ? 'preview' : 'full'}
												onPanChange={(x, y) => {
													setPanX(x);
													setPanY(y);
												}}
											/>
										)}
									</CheckerBoard>

									{/* Frame controls - Floating above canvas bottom */}
									{draftItem.frames > 1 && (
										<>
											{/* Frame count - Bottom Left */}
											<div className="absolute bottom-2 left-2 z-10 bg-secondary/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-muted-foreground font-mono border border-border/50 shadow-lg">
												Frame {currentFrame + 1}/{draftItem.frames}
											</div>

											{/* Frame bar - Bottom Center */}
											<div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 bg-secondary/90 backdrop-blur-sm rounded-md px-1 py-0.5 border border-border/50 shadow-lg">
												<Button
													size="icon"
													variant="ghost"
													onClick={handleFirstFrame}
													disabled={currentFrame === 0 || isPlaying}
													className="h-6 w-6 hover:bg-secondary/50 p-0"
												>
													<SkipBack className="h-3 w-3" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													onClick={handlePrevFrame}
													disabled={currentFrame === 0 || isPlaying}
													className="h-6 w-6 hover:bg-secondary/50 p-0"
												>
													<ChevronLeft className="h-3 w-3" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													onClick={handlePlayPause}
													className={`h-6 w-6 p-0 ${isPlaying ? 'bg-primary/20 text-primary' : 'hover:bg-primary/20'}`}
												>
													{isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
												</Button>
												<Button
													size="icon"
													variant="ghost"
													onClick={handleNextFrame}
													className="h-6 w-6 hover:bg-secondary/50 p-0"
													disabled={currentFrame >= draftItem.frames - 1 || isPlaying}
												>
													<ChevronRight className="h-3 w-3" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													onClick={handleLastFrame}
													className="h-6 w-6 hover:bg-secondary/50 p-0"
													disabled={currentFrame >= draftItem.frames - 1 || isPlaying}
												>
													<SkipForward className="h-3 w-3" />
												</Button>
											</div>
										</>
									)}
								</div>
							</div>
						</div>

						<div className="flex flex-col gap-4 min-[820px]:col-span-1">
							<div className="bg-secondary/20 rounded-md border border-border/40 overflow-hidden">
								<div className="flex items-center justify-between gap-1.5 px-3 py-2 bg-secondary/40 border-b border-border/30">
									<div className="flex items-center gap-1.5">
										<div className="w-0.5 h-3 bg-primary rounded-full" />
										<h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Dimensions</h3>
									</div>
									{isOutfit && draftItem && supportsFrameGroups && (
										<div className="flex items-center gap-2">
											<Label className="text-[10px] text-muted-foreground whitespace-nowrap">Frame Group</Label>
											<Select
												value={selectedFrameGroup.toString()}
												onValueChange={(val) => handleFrameGroupChange(parseInt(val))}
											>
												<SelectTrigger className="h-6 w-[100px] text-[10px]">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{(draftItem.frameGroupsData || []).map((group, idx) => (
														<SelectItem key={idx} value={idx.toString()} className="text-[10px]">
															{group.type === 0 ? 'Idle' : 'Walking'}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											{(draftItem.frameGroupsData || []).length < 2 && (
												<Button
													size="sm"
													variant="ghost"
													title="Create new frame group"
													onClick={handleCreateFrameGroup}
													className="h-6 w-6 p-0 hover:bg-secondary/50"
												>
													<Plus className="h-3 w-3" />
												</Button>
											)}
											{(draftItem.frameGroupsData || []).length > 1 && (
												<Button
													size="sm"
													variant="ghost"
													onClick={handleDeleteFrameGroup}
													title="Delete current frame group"
													className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
												>
													<X className="h-3 w-3" />
												</Button>
											)}
										</div>
									)}
								</div>
								<div className="p-3 grid grid-cols-2 gap-3">
									<div className="flex items-center justify-between gap-2">
										<Label htmlFor="width" className="text-xs whitespace-nowrap text-muted-foreground">
											Width
										</Label>
										<PropertyWithUndo property="width">
											<NumberInput
												min={1}
												max={128}
												id="width"
												value={draftItem.width}
												className="h-7 w-16 text-right"
												onChange={(val) => handlePropertyChange('width', val)}
											/>
										</PropertyWithUndo>
									</div>
									<div className="flex items-center justify-between gap-2">
										<Label htmlFor="height" className="text-xs whitespace-nowrap text-muted-foreground">
											Height
										</Label>
										<PropertyWithUndo property="height">
											<NumberInput
												min={1}
												max={128}
												id="height"
												value={draftItem.height}
												className="h-7 w-16 text-right"
												onChange={(val) => handlePropertyChange('height', val)}
											/>
										</PropertyWithUndo>
									</div>
									<div className="flex items-center justify-between gap-2">
										<Label htmlFor="crop-size" className="text-xs whitespace-nowrap text-muted-foreground">
											Exact Size
										</Label>
										<PropertyWithUndo property="exactSize">
											<NumberInput
												min={1}
												max={128}
												id="crop-size"
												value={draftItem.exactSize}
												className="h-7 w-16 text-right"
												onChange={(val) => handlePropertyChange('exactSize', val)}
											/>
										</PropertyWithUndo>
									</div>
									<div className="flex items-center justify-between gap-2">
										<Label htmlFor="frames" className="text-xs whitespace-nowrap text-muted-foreground">
											Frames
										</Label>
										<PropertyWithUndo property="frames">
											<NumberInput
												id="frames"
												value={draftItem.frames}
												className="h-7 w-16 text-right"
												onChange={(val) => handlePropertyChange('frames', val)}
											/>
										</PropertyWithUndo>
									</div>
								</div>
							</div>

							<div className="bg-secondary/20 rounded-md border border-border/40 overflow-hidden">
								<div className="flex items-center gap-1.5 px-3 py-2 bg-secondary/40 border-b border-border/30">
									<div className="w-0.5 h-3 bg-primary rounded-full" />
									<h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Pattern & Layers</h3>
								</div>
								<div className="p-3 grid grid-cols-2 gap-3">
									<div className="flex items-center justify-between gap-2">
										<Label htmlFor="pattern-x" className="text-xs whitespace-nowrap text-muted-foreground">
											Pattern X
										</Label>
										<PropertyWithUndo property="patternX">
											<NumberInput
												id="pattern-x"
												value={draftItem.patternX}
												className="h-7 w-16 text-right"
												onChange={(val) => handlePropertyChange('patternX', val)}
											/>
										</PropertyWithUndo>
									</div>
									<div className="flex items-center justify-between gap-2">
										<Label htmlFor="pattern-y" className="text-xs whitespace-nowrap text-muted-foreground">
											Pattern Y
										</Label>
										<PropertyWithUndo property="patternY">
											<NumberInput
												id="pattern-y"
												value={draftItem.patternY}
												className="h-7 w-16 text-right"
												onChange={(val) => handlePropertyChange('patternY', val)}
											/>
										</PropertyWithUndo>
									</div>
									{showPatternZ && (
										<div className="flex items-center justify-between gap-2">
											<Label htmlFor="pattern-z" className="text-xs whitespace-nowrap text-muted-foreground">
												Pattern Z
											</Label>
											<PropertyWithUndo property="patternZ">
												<NumberInput
													id="pattern-z"
													value={draftItem.patternZ}
													className="h-7 w-16 text-right"
													onChange={(val) => handlePropertyChange('patternZ', val)}
												/>
											</PropertyWithUndo>
										</div>
									)}
									<div className="flex items-center justify-between gap-2">
										<Label htmlFor="layers" className="text-xs whitespace-nowrap text-muted-foreground">
											Layers
										</Label>
										<PropertyWithUndo property="layers">
											<NumberInput
												min={1}
												max={128}
												id="layers"
												value={draftItem.layers}
												className="h-7 w-16 text-right"
												onChange={(val) => handlePropertyChange('layers', val)}
											/>
										</PropertyWithUndo>
									</div>
								</div>
							</div>

							<div className="bg-secondary/20 rounded-md border border-border/40 overflow-hidden">
								<div className="flex items-center gap-1.5 px-3 py-2 bg-secondary/40 border-b border-border/30">
									<div className="w-0.5 h-3 bg-primary rounded-full" />
									<h3 className="text-xs font-bold text-foreground uppercase tracking-wider">View Options</h3>
								</div>
								<div className="p-3 grid grid-cols-2 gap-3">
									<div className="flex items-center justify-between gap-2">
										<Label htmlFor="show-exact-size" className="text-xs whitespace-nowrap text-muted-foreground">
											Show Exact Size
										</Label>
										<Switch id="show-exact-size" checked={showExactSize} onCheckedChange={setShowExactSize} />
									</div>
									<div className="flex items-center justify-between gap-2">
										<Label htmlFor="show-grid" className="text-xs whitespace-nowrap text-muted-foreground">
											Show Grid
										</Label>
										<Switch id="show-grid" checked={showGrid} onCheckedChange={setShowGrid} />
									</div>
								</div>
							</div>
						</div>

						{!isOutfit && (
							<div className="hidden min-[1400px]:block">
								<div className="bg-secondary/20 rounded-md border border-border/40 overflow-hidden h-[361px] flex flex-col">
									<div className="flex items-center gap-1.5 px-3 py-2 bg-secondary/40 border-b border-border/30 flex-shrink-0">
										<div className="w-0.5 h-3 bg-primary rounded-full" />
										<h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Visuals</h3>
									</div>
									<div className="p-3 space-y-4 overflow-y-auto flex-1">
										{/* Light Settings */}
										<div>
											<div className="pb-1 mb-3 border-b border-border/30"></div>
											<div className="space-y-2 pl-1">
												<div className="flex items-center justify-between">
													<Label className="text-xs text-muted-foreground">Has Light</Label>
													<Switch
														checked={draftItem.hasLight}
														onCheckedChange={(checked) => handlePropertyChange('hasLight', checked)}
													/>
												</div>
												<div className="grid grid-cols-2 gap-2 pl-2 border-l-2 border-border/30">
													<div className="flex flex-col gap-1">
														<Label className="text-[10px] text-muted-foreground">Color</Label>
														<EightBitColorPicker
															className="w-full"
															disabled={!draftItem.hasLight}
															value={draftItem.lightColor || 0}
															onChange={(val) => handlePropertyChange('lightColor', val)}
														/>
													</div>
													<div className="flex flex-col gap-1">
														<Label className="text-[10px] text-muted-foreground">Intensity</Label>
														<PropertyWithUndo property="lightLevel">
															<NumberInput
																disabled={!draftItem.hasLight}
																value={draftItem.lightLevel || 0}
																className="h-7 w-full text-right"
																onChange={(val) => handlePropertyChange('lightLevel', val)}
															/>
														</PropertyWithUndo>
													</div>
												</div>
											</div>
										</div>

										{/* Displacement */}
										{showDisplacement && (
											<div>
												<div className="pb-1 mb-3 border-b border-border/30"></div>
												<div className="space-y-2 pl-1">
													<div className="flex items-center justify-between">
														<Label className="text-xs text-muted-foreground">Has Offset</Label>
														<PropertyWithUndo property="hasOffset">
															<Switch
																checked={draftItem.hasOffset}
																onCheckedChange={(checked) => handlePropertyChange('hasOffset', checked)}
															/>
														</PropertyWithUndo>
													</div>
													<div className="grid grid-cols-2 gap-2 pl-2 border-l-2 border-border/30">
														<div className="flex items-center gap-1">
															<Label className="text-[10px] text-muted-foreground">X:</Label>
															<PropertyWithUndo property="offsetX">
																<NumberInput
																	value={draftItem.offsetX || 0}
																	disabled={!draftItem.hasOffset}
																	className="h-7 w-full text-right"
																	onChange={(val) => handlePropertyChange('offsetX', val)}
																/>
															</PropertyWithUndo>
														</div>
														<div className="flex items-center gap-1">
															<Label className="text-[10px] text-muted-foreground">Y:</Label>
															<PropertyWithUndo property="offsetY">
																<NumberInput
																	value={draftItem.offsetY || 0}
																	disabled={!draftItem.hasOffset}
																	className="h-7 w-full text-right"
																	onChange={(val) => handlePropertyChange('offsetY', val)}
																/>
															</PropertyWithUndo>
														</div>
													</div>
													{showDisplacementElevation && (
														<div className="flex items-center justify-between">
															<Label className="text-xs text-muted-foreground">Elevation</Label>
															<div className="flex items-center gap-2">
																<PropertyWithUndo property="elevation">
																	<NumberInput
																		className="h-7 w-16 text-right"
																		value={draftItem.elevation || 0}
																		disabled={!draftItem.hasElevation}
																		onChange={(val) => handlePropertyChange('elevation', val)}
																	/>
																</PropertyWithUndo>
																<PropertyWithUndo property="hasElevation">
																	<Switch
																		checked={draftItem.hasElevation}
																		onCheckedChange={(checked) => handlePropertyChange('hasElevation', checked)}
																	/>
																</PropertyWithUndo>
															</div>
														</div>
													)}
												</div>
											</div>
										)}

										{/* Minimap */}
										{showMinimap && (
											<div>
												<div className="pb-1 mb-3 border-b border-border/30"></div>
												<div className="space-y-2 pl-1">
													<div className="flex items-center justify-between">
														<Label className="text-xs text-muted-foreground">Show on Minimap</Label>
														<PropertyWithUndo property="miniMap">
															<Switch
																checked={draftItem.miniMap}
																onCheckedChange={(checked) => handlePropertyChange('miniMap', checked)}
															/>
														</PropertyWithUndo>
													</div>
													<div className="flex items-center justify-between pl-2 border-l-2 border-border/30">
														<Label className="text-[10px] text-muted-foreground">Color</Label>
														<EightBitColorPicker
															disabled={!draftItem.miniMap}
															value={draftItem.miniMapColor || 0}
															onChange={(val) => handlePropertyChange('miniMapColor', val)}
														/>
													</div>
												</div>
											</div>
										)}

										{/* Flags - For Outfits */}
										{showAnimateAlways && (
											<div>
												<div className="pb-1 mb-3 border-b border-border/30"></div>
												<div className="space-y-2 pl-1">
													<div className="flex items-center justify-between">
														<Label className="text-xs text-muted-foreground">Animate Always</Label>
														<Switch
															checked={draftItem.animateAlways}
															onCheckedChange={(checked) => handlePropertyChange('animateAlways', checked)}
														/>
													</div>
												</div>
											</div>
										)}

										{/* Outfit Colors - Only show for outfits with color mask (layers > 1) */}
										{isOutfit && draftItem && draftItem.layers > 1 && (
											<div>
												<div className="pb-1 mb-3 border-b border-border/30"></div>
												<div className="space-y-2 pl-1">
													<div className="grid grid-cols-2 gap-2">
														<div className="flex flex-col gap-1">
															<Label className="text-[10px] text-muted-foreground">Head</Label>
															<TibiaColorPicker
																className="w-full"
																value={outfitData.head}
																onChange={(val) => {
																	const clampedVal = Math.max(0, Math.min(255, Math.floor(val)));
																	setOutfitData({ ...outfitData, head: clampedVal });
																}}
															/>
														</div>
														<div className="flex flex-col gap-1">
															<Label className="text-[10px] text-muted-foreground">Body</Label>
															<TibiaColorPicker
																className="w-full"
																value={outfitData.body}
																onChange={(val) => {
																	const clampedVal = Math.max(0, Math.min(255, Math.floor(val)));
																	setOutfitData({ ...outfitData, body: clampedVal });
																}}
															/>
														</div>
														<div className="flex flex-col gap-1">
															<Label className="text-[10px] text-muted-foreground">Legs</Label>
															<TibiaColorPicker
																className="w-full"
																value={outfitData.legs}
																onChange={(val) => {
																	const clampedVal = Math.max(0, Math.min(255, Math.floor(val)));
																	setOutfitData({ ...outfitData, legs: clampedVal });
																}}
															/>
														</div>
														<div className="flex flex-col gap-1">
															<Label className="text-[10px] text-muted-foreground">Feet</Label>
															<TibiaColorPicker
																className="w-full"
																value={outfitData.feet}
																onChange={(val) => {
																	const clampedVal = Math.max(0, Math.min(255, Math.floor(val)));
																	setOutfitData({ ...outfitData, feet: clampedVal });
																}}
															/>
														</div>
													</div>
												</div>
											</div>
										)}

										{/* Addons - For Outfits */}
										{isOutfit && item && item.patternY > 1 && (
											<div>
												<div className="pb-1 mb-3 border-b border-border/30"></div>
												<div className="space-y-2 pl-1">
													{Array.from({ length: item.patternY - 1 }, (_, i) => i + 1).map((addonLevel) => (
														<div key={addonLevel} className="flex items-center justify-between">
															<Label className="text-xs text-muted-foreground">Addon {addonLevel}</Label>
															<Switch
																checked={outfitData.addons[addonLevel - 1] || false}
																onCheckedChange={(checked) => {
																	const newAddons = [...outfitData.addons];
																	newAddons[addonLevel - 1] = checked;
																	setOutfitData({ ...outfitData, addons: newAddons });
																}}
															/>
														</div>
													))}
												</div>
											</div>
										)}
									</div>
								</div>
							</div>
						)}
					</div>

					<Separator />

					<div className="bg-secondary/20 rounded-md border border-border/40 overflow-hidden mt-4">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
							{/* Column 1 - Physical & Visual Attributes */}
							<div className="space-y-6">
								{/* Physics & Ground */}
								{showPhysicsGround && (
									<div>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Physics & Ground</h4>
										</div>
										<div className="space-y-3 pl-1">
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Is Ground</Label>
												<div className="flex items-center gap-2">
													<PropertyWithUndo property="groundSpeed">
														<NumberInput
															placeholder="Speed"
															disabled={!draftItem.isGround}
															className="h-7 w-16 text-right"
															value={draftItem.groundSpeed || 0}
															onChange={(val) => handlePropertyChange('groundSpeed', val)}
														/>
													</PropertyWithUndo>
													<PropertyWithUndo property="isGround">
														<Switch
															checked={draftItem.isGround}
															onCheckedChange={(checked) => handlePropertyChange('isGround', checked)}
														/>
													</PropertyWithUndo>
												</div>
											</div>
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Unpassable</Label>
												<PropertyWithUndo property="isUnpassable">
													<Switch
														checked={draftItem.isUnpassable}
														onCheckedChange={(checked) => handlePropertyChange('isUnpassable', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Unmoveable</Label>
												<PropertyWithUndo property="isUnmoveable">
													<Switch
														checked={draftItem.isUnmoveable}
														onCheckedChange={(checked) => handlePropertyChange('isUnmoveable', checked)}
													/>
												</PropertyWithUndo>
											</div>
											{showNoMoveAnimation && (
												<div className="flex items-center justify-between">
													<Label className="text-xs text-muted-foreground">No Move Animation</Label>
													<PropertyWithUndo property="noMoveAnimation">
														<Switch
															checked={draftItem.noMoveAnimation}
															onCheckedChange={(checked) => handlePropertyChange('noMoveAnimation', checked)}
														/>
													</PropertyWithUndo>
												</div>
											)}
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Block Pathfind</Label>
												<PropertyWithUndo property="blockPathfind">
													<Switch
														checked={draftItem.blockPathfind}
														onCheckedChange={(checked) => handlePropertyChange('blockPathfind', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Block Missiles</Label>
												<PropertyWithUndo property="blockMissile">
													<Switch
														checked={draftItem.blockMissile}
														onCheckedChange={(checked) => handlePropertyChange('blockMissile', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Full Ground</Label>
												<PropertyWithUndo property="isFullGround">
													<Switch
														checked={draftItem.isFullGround}
														onCheckedChange={(checked) => handlePropertyChange('isFullGround', checked)}
													/>
												</PropertyWithUndo>
											</div>
										</div>
									</div>
								)}

								{/* Appearance */}
								{isItem && (
									<div>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Appearance</h4>
										</div>
										<div className="space-y-2 pl-1">
											{showLensHelp && (
												<div className="flex items-center justify-between">
													<Label className="text-xs text-muted-foreground">Lens Help</Label>
													<div className="flex items-center gap-2">
														<PropertyWithUndo property="lensHelp">
															<NumberInput
																value={draftItem.lensHelp || 0}
																className="h-7 w-16 text-right"
																disabled={!draftItem.isLensHelp}
																onChange={(val) => handlePropertyChange('lensHelp', val)}
															/>
														</PropertyWithUndo>
														<PropertyWithUndo property="isLensHelp">
															<Switch
																checked={draftItem.isLensHelp}
																onCheckedChange={(checked) => handlePropertyChange('isLensHelp', checked)}
															/>
														</PropertyWithUndo>
													</div>
												</div>
											)}
											{showTranslucent && (
												<div className="flex items-center justify-between">
													<Label className="text-xs text-muted-foreground">Translucent</Label>
													<PropertyWithUndo property="isTranslucent">
														<Switch
															checked={draftItem.isTranslucent}
															onCheckedChange={(checked) => handlePropertyChange('isTranslucent', checked)}
														/>
													</PropertyWithUndo>
												</div>
											)}
											{showDontHide && (
												<div className="flex items-center justify-between">
													<Label className="text-xs text-muted-foreground">Don't Hide</Label>
													<PropertyWithUndo property="dontHide">
														<Switch
															checked={draftItem.dontHide}
															onCheckedChange={(checked) => handlePropertyChange('dontHide', checked)}
														/>
													</PropertyWithUndo>
												</div>
											)}
											{showIgnoreLook && (
												<div className="flex items-center justify-between">
													<Label className="text-xs text-muted-foreground">Ignore Look</Label>
													<PropertyWithUndo property="ignoreLook">
														<Switch
															checked={draftItem.ignoreLook}
															onCheckedChange={(checked) => handlePropertyChange('ignoreLook', checked)}
														/>
													</PropertyWithUndo>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Light Settings - Show when top Visuals block is hidden or for outfits */}
								<div className={isOutfit ? '' : 'min-[1400px]:hidden'}>
									<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
										<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Light</h4>
									</div>
									<div className="space-y-2 pl-1">
										<div className="flex items-center justify-between">
											<Label className="text-xs text-muted-foreground">Has Light</Label>
											<PropertyWithUndo property="hasLight">
												<Switch
													checked={draftItem.hasLight}
													onCheckedChange={(checked) => handlePropertyChange('hasLight', checked)}
												/>
											</PropertyWithUndo>
										</div>
										<div className="grid grid-cols-2 gap-2 pl-2 border-l-2 border-border/30">
											<div className="flex flex-col gap-1">
												<Label className="text-[10px] text-muted-foreground">Color</Label>
												<EightBitColorPicker
													className="w-full"
													disabled={!draftItem.hasLight}
													value={draftItem.lightColor || 0}
													onChange={(val) => handlePropertyChange('lightColor', val)}
												/>
											</div>
											<div className="flex flex-col gap-1">
												<Label className="text-[10px] text-muted-foreground">Intensity</Label>
												<PropertyWithUndo property="lightLevel">
													<NumberInput
														disabled={!draftItem.hasLight}
														value={draftItem.lightLevel || 0}
														className="h-7 w-full text-right"
														onChange={(val) => handlePropertyChange('lightLevel', val)}
													/>
												</PropertyWithUndo>
											</div>
										</div>
									</div>
								</div>

								{/* Flags - For Outfits */}
								{isOutfit && showAnimateAlways && (
									<div>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Flags</h4>
										</div>
										<div className="space-y-2 pl-1">
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Animate Always</Label>
												<Switch
													checked={draftItem.animateAlways}
													onCheckedChange={(checked) => handlePropertyChange('animateAlways', checked)}
												/>
											</div>
										</div>
									</div>
								)}

								{/* Market */}
								{showMarket && (
									<div>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Market</h4>
										</div>
										<div className="space-y-2 pl-1">
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Market Item</Label>
												<PropertyWithUndo property="isMarketItem">
													<Switch
														checked={draftItem.isMarketItem}
														onCheckedChange={(checked) => handlePropertyChange('isMarketItem', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="pl-2 border-l-2 border-border/30 space-y-2">
												<div className="flex flex-col gap-1">
													<Label className="text-[10px] text-muted-foreground">Name</Label>
													<Input
														value={draftItem.marketName || ''}
														disabled={!draftItem.isMarketItem}
														onChange={(e) => handlePropertyChange('marketName', e.target.value)}
														className="h-7 w-full text-xs bg-background/50 shadow-sm hover:bg-background/80 transition-colors"
													/>
												</div>
												<div className="grid grid-cols-2 gap-2">
													<div className="flex flex-col gap-1">
														<Label className="text-[10px] text-muted-foreground">Category</Label>
														<Select
															disabled={!draftItem.isMarketItem}
															value={String(draftItem.marketCategory || 1)}
															onValueChange={(val) => handlePropertyChange('marketCategory', parseInt(val))}
														>
															<SelectTrigger className="h-7 w-full text-xs bg-background/50 shadow-sm hover:bg-background/80 transition-colors">
																<SelectValue placeholder="Select category" />
															</SelectTrigger>
															<SelectContent>
																{Object.entries(MarketCategory)
																	.filter(([key]) => isNaN(Number(key)))
																	.map(([key, value]) => (
																		<SelectItem key={value} value={String(value)}>
																			{key.replace(/_/g, ' ')}
																		</SelectItem>
																	))}
															</SelectContent>
														</Select>
													</div>
													<div className="flex flex-col gap-1">
														<Label className="text-[10px] text-muted-foreground">Trade As</Label>
														<NumberInput
															className="h-7 w-full text-right"
															disabled={!draftItem.isMarketItem}
															value={draftItem.marketTradeAs || 0}
															onChange={(val) => handlePropertyChange('marketTradeAs', val)}
														/>
													</div>
												</div>
												<div className="grid grid-cols-2 gap-2">
													<div className="flex flex-col gap-1">
														<Label className="text-[10px] text-muted-foreground">Show As</Label>
														<NumberInput
															className="h-7 w-full text-right"
															disabled={!draftItem.isMarketItem}
															value={draftItem.marketShowAs || 0}
															onChange={(val) => handlePropertyChange('marketShowAs', val)}
														/>
													</div>
													<div className="flex flex-col gap-1">
														<Label className="text-[10px] text-muted-foreground">Profession</Label>
														<NumberInput
															className="h-7 w-full text-right"
															disabled={!draftItem.isMarketItem}
															value={draftItem.marketRestrictProfession || 0}
															onChange={(val) => handlePropertyChange('marketRestrictProfession', val)}
														/>
													</div>
												</div>
												<div className="flex flex-col gap-1">
													<Label className="text-[10px] text-muted-foreground">Level</Label>
													<NumberInput
														className="h-7 w-full text-right"
														disabled={!draftItem.isMarketItem}
														value={draftItem.marketRestrictLevel || 0}
														onChange={(val) => handlePropertyChange('marketRestrictLevel', val)}
													/>
												</div>
											</div>
										</div>
									</div>
								)}
							</div>

							{/* Column 2 - Interaction & Gameplay */}
							<div className="space-y-6">
								{/* Interaction */}
								{showInteraction && (
									<div>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Interaction</h4>
										</div>
										<div className="space-y-3 pl-1">
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Pickupable</Label>
												<PropertyWithUndo property="pickupable">
													<Switch
														checked={draftItem.pickupable}
														onCheckedChange={(checked) => handlePropertyChange('pickupable', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Stackable</Label>
												<PropertyWithUndo property="stackable">
													<Switch
														checked={draftItem.stackable}
														onCheckedChange={(checked) => handlePropertyChange('stackable', checked)}
													/>
												</PropertyWithUndo>
											</div>
											{showHasCharges && (
												<div className="flex items-center justify-between">
													<Label className="text-xs text-muted-foreground">Has Charges</Label>
													<PropertyWithUndo property="hasCharges">
														<Switch
															checked={draftItem.hasCharges}
															onCheckedChange={(checked) => handlePropertyChange('hasCharges', checked)}
														/>
													</PropertyWithUndo>
												</div>
											)}
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Container</Label>
												<PropertyWithUndo property="isContainer">
													<Switch
														checked={draftItem.isContainer}
														onCheckedChange={(checked) => handlePropertyChange('isContainer', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Rotatable</Label>
												<PropertyWithUndo property="rotatable">
													<Switch
														checked={draftItem.rotatable}
														onCheckedChange={(checked) => handlePropertyChange('rotatable', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Multi Use</Label>
												<PropertyWithUndo property="multiUse">
													<Switch
														checked={draftItem.multiUse}
														onCheckedChange={(checked) => handlePropertyChange('multiUse', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Force Use</Label>
												<PropertyWithUndo property="forceUse">
													<Switch
														checked={draftItem.forceUse}
														onCheckedChange={(checked) => handlePropertyChange('forceUse', checked)}
													/>
												</PropertyWithUndo>
											</div>
											{showUsable && (
												<div className="flex items-center justify-between">
													<Label className="text-xs text-muted-foreground">Usable</Label>
													<PropertyWithUndo property="usable">
														<Switch
															checked={draftItem.usable}
															onCheckedChange={(checked) => handlePropertyChange('usable', checked)}
														/>
													</PropertyWithUndo>
												</div>
											)}
											{showWrappable && (
												<>
													<div className="flex items-center justify-between">
														<Label className="text-xs text-muted-foreground">Wrappable</Label>
														<PropertyWithUndo property="wrappable">
															<Switch
																checked={draftItem.wrappable}
																onCheckedChange={(checked) => handlePropertyChange('wrappable', checked)}
															/>
														</PropertyWithUndo>
													</div>
													<div className="flex items-center justify-between">
														<Label className="text-xs text-muted-foreground">Unwrappable</Label>
														<PropertyWithUndo property="unwrappable">
															<Switch
																checked={draftItem.unwrappable}
																onCheckedChange={(checked) => handlePropertyChange('unwrappable', checked)}
															/>
														</PropertyWithUndo>
													</div>
												</>
											)}
										</div>
									</div>
								)}

								{/* Hooks & Hanging */}
								{showHooks && (
									<div>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Hooks & Hanging</h4>
										</div>
										<div className="space-y-3 pl-1">
											{showHangable && (
												<div className="flex items-center justify-between">
													<Label className="text-xs text-muted-foreground">Hangable</Label>
													<PropertyWithUndo property="hangable">
														<Switch
															checked={draftItem.hangable}
															onCheckedChange={(checked) => handlePropertyChange('hangable', checked)}
														/>
													</PropertyWithUndo>
												</div>
											)}
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Horizontal Hook</Label>
												<PropertyWithUndo property="isHorizontal">
													<Switch
														checked={draftItem.isHorizontal}
														onCheckedChange={(checked) => handlePropertyChange('isHorizontal', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Vertical Hook</Label>
												<PropertyWithUndo property="isVertical">
													<Switch
														checked={draftItem.isVertical}
														onCheckedChange={(checked) => handlePropertyChange('isVertical', checked)}
													/>
												</PropertyWithUndo>
											</div>
										</div>
									</div>
								)}

								{/* Default Actions */}
								{showDefaultActions && (
									<div>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Default Actions</h4>
										</div>
										<div className="space-y-2 pl-1">
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Has Default Action</Label>
												<PropertyWithUndo property="hasDefaultAction">
													<Switch
														checked={draftItem.hasDefaultAction}
														onCheckedChange={(checked) => handlePropertyChange('hasDefaultAction', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between pl-2 border-l-2 border-border/30">
												<Label className="text-[10px] text-muted-foreground">Action</Label>
												<PropertyWithUndo property="defaultAction">
													<NumberInput
														className="h-7 w-16 text-right"
														value={draftItem.defaultAction || 0}
														disabled={!draftItem.hasDefaultAction}
														onChange={(val) => handlePropertyChange('defaultAction', val)}
													/>
												</PropertyWithUndo>
											</div>
										</div>
									</div>
								)}

								{/* Equipment */}
								{showEquipment && (
									<div>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Equipment</h4>
										</div>
										<div className="space-y-2 pl-1">
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Is Cloth</Label>
												<PropertyWithUndo property="cloth">
													<Switch
														checked={draftItem.cloth}
														onCheckedChange={(checked) => handlePropertyChange('cloth', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between pl-2 border-l-2 border-border/30">
												<Label className="text-[10px] text-muted-foreground">Slot</Label>
												<PropertyWithUndo property="clothSlot">
													<NumberInput
														disabled={!draftItem.cloth}
														className="h-7 w-16 text-right"
														value={draftItem.clothSlot || 0}
														onChange={(val) => handlePropertyChange('clothSlot', val)}
													/>
												</PropertyWithUndo>
											</div>
										</div>
									</div>
								)}

								{/* Displacement - Show when top Visuals block is hidden or for outfits */}
								{showDisplacement && (
									<div className={isOutfit ? '' : 'min-[1400px]:hidden'}>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Displacement</h4>
										</div>
										<div className="space-y-2 pl-1">
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Has Offset</Label>
												<PropertyWithUndo property="hasOffset">
													<Switch
														checked={draftItem.hasOffset}
														onCheckedChange={(checked) => handlePropertyChange('hasOffset', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="grid grid-cols-2 gap-2 pl-2 border-l-2 border-border/30">
												<div className="flex items-center gap-1">
													<Label className="text-[10px] text-muted-foreground">X:</Label>
													<PropertyWithUndo property="offsetX">
														<NumberInput
															value={draftItem.offsetX || 0}
															disabled={!draftItem.hasOffset}
															className="h-7 w-full text-right"
															onChange={(val) => handlePropertyChange('offsetX', val)}
														/>
													</PropertyWithUndo>
												</div>
												<div className="flex items-center gap-1">
													<Label className="text-[10px] text-muted-foreground">Y:</Label>
													<PropertyWithUndo property="offsetY">
														<NumberInput
															value={draftItem.offsetY || 0}
															disabled={!draftItem.hasOffset}
															className="h-7 w-full text-right"
															onChange={(val) => handlePropertyChange('offsetY', val)}
														/>
													</PropertyWithUndo>
												</div>
											</div>
											{showDisplacementElevation && (
												<div className="flex items-center justify-between">
													<Label className="text-xs text-muted-foreground">Elevation</Label>
													<div className="flex items-center gap-2">
														<PropertyWithUndo property="elevation">
															<NumberInput
																className="h-7 w-16 text-right"
																value={draftItem.elevation || 0}
																disabled={!draftItem.hasElevation}
																onChange={(val) => handlePropertyChange('elevation', val)}
															/>
														</PropertyWithUndo>
														<PropertyWithUndo property="hasElevation">
															<Switch
																checked={draftItem.hasElevation}
																onCheckedChange={(checked) => handlePropertyChange('hasElevation', checked)}
															/>
														</PropertyWithUndo>
													</div>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Addons - For Outfits */}
								{isOutfit && item && item.patternY > 1 && (
									<div>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Addons</h4>
										</div>
										<div className="space-y-2 pl-1">
											{Array.from({ length: item.patternY - 1 }, (_, i) => i + 1).map((addonLevel) => (
												<div key={addonLevel} className="flex items-center justify-between">
													<Label className="text-xs text-muted-foreground">Addon {addonLevel}</Label>
													<Switch
														checked={outfitData.addons[addonLevel - 1] || false}
														onCheckedChange={(checked) => {
															const newAddons = [...outfitData.addons];
															newAddons[addonLevel - 1] = checked;
															setOutfitData({ ...outfitData, addons: newAddons });
														}}
													/>
												</div>
											))}
										</div>
									</div>
								)}
							</div>

							{/* Column 3 - Positioning & Metadata */}
							<div className="space-y-6">
								{/* Outfit Colors - Only show for outfits with color mask (layers > 1) */}
								{isOutfit && draftItem && draftItem.layers > 1 && (
									<div>
										<div className="flex items-center justify-between gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Outfit Colors</h4>
											<Button
												size="icon"
												variant="ghost"
												title="Randomize colors"
												onClick={handleRandomizeColors}
												className="h-6 w-6 hover:bg-primary/20 hover:text-primary transition-colors"
											>
												<Shuffle className="h-3.5 w-3.5" />
											</Button>
										</div>
										<div className="space-y-2 pl-1">
											<div className="grid grid-cols-2 gap-2">
												<div className="flex flex-col gap-1">
													<Label className="text-[10px] text-muted-foreground">Head</Label>
													<TibiaColorPicker
														className="w-full"
														value={outfitData.head}
														onChange={(val) => {
															const clampedVal = Math.max(0, Math.min(255, Math.floor(val)));
															setOutfitData({ ...outfitData, head: clampedVal });
														}}
													/>
												</div>
												<div className="flex flex-col gap-1">
													<Label className="text-[10px] text-muted-foreground">Body</Label>
													<TibiaColorPicker
														className="w-full"
														value={outfitData.body}
														onChange={(val) => {
															const clampedVal = Math.max(0, Math.min(255, Math.floor(val)));
															setOutfitData({ ...outfitData, body: clampedVal });
														}}
													/>
												</div>
												<div className="flex flex-col gap-1">
													<Label className="text-[10px] text-muted-foreground">Legs</Label>
													<TibiaColorPicker
														className="w-full"
														value={outfitData.legs}
														onChange={(val) => {
															const clampedVal = Math.max(0, Math.min(255, Math.floor(val)));
															setOutfitData({ ...outfitData, legs: clampedVal });
														}}
													/>
												</div>
												<div className="flex flex-col gap-1">
													<Label className="text-[10px] text-muted-foreground">Feet</Label>
													<TibiaColorPicker
														className="w-full"
														value={outfitData.feet}
														onChange={(val) => {
															const clampedVal = Math.max(0, Math.min(255, Math.floor(val)));
															setOutfitData({ ...outfitData, feet: clampedVal });
														}}
													/>
												</div>
											</div>
										</div>
									</div>
								)}

								{/* Flags - For Outfits (only show when top Visuals is hidden and not an outfit) */}
								{showAnimateAlways && !isOutfit && (
									<div className="min-[1400px]:hidden">
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Flags</h4>
										</div>
										<div className="space-y-2 pl-1">
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Animate Always</Label>
												<Switch
													checked={draftItem.animateAlways}
													onCheckedChange={(checked) => handlePropertyChange('animateAlways', checked)}
												/>
											</div>
										</div>
									</div>
								)}

								{/* Writing & Reading */}
								{showWriting && (
									<div>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Writing & Reading</h4>
										</div>
										<div className="space-y-2 pl-1">
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Writable</Label>
												<PropertyWithUndo property="writable">
													<Switch
														checked={draftItem.writable}
														onCheckedChange={(checked) => handlePropertyChange('writable', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Writable Once</Label>
												<PropertyWithUndo property="writableOnce">
													<Switch
														checked={draftItem.writableOnce}
														onCheckedChange={(checked) => handlePropertyChange('writableOnce', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between pl-2 border-l-2 border-border/30">
												<Label className="text-[10px] text-muted-foreground">Max Chars</Label>
												<PropertyWithUndo property="maxTextLength">
													<NumberInput
														className="h-7 w-16 text-right"
														value={draftItem.maxTextLength || 0}
														disabled={!draftItem.writable && !draftItem.writableOnce}
														onChange={(val) => handlePropertyChange('maxTextLength', val)}
													/>
												</PropertyWithUndo>
											</div>
										</div>
									</div>
								)}

								{/* Layer Position */}
								{showLayerPosition && (
									<div>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Layer Position</h4>
										</div>
										<div className="space-y-2 pl-1">
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Lying Object</Label>
												<PropertyWithUndo property="isLyingObject">
													<Switch
														checked={draftItem.isLyingObject}
														onCheckedChange={(checked) => handlePropertyChange('isLyingObject', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Always On Top</Label>
												<PropertyWithUndo property="isOnTop">
													<Switch
														checked={draftItem.isOnTop}
														onCheckedChange={(checked) => handlePropertyChange('isOnTop', checked)}
													/>
												</PropertyWithUndo>
											</div>
											{showTopEffect && (
												<div className="flex items-center justify-between">
													<Label className="text-xs text-muted-foreground">Top Effect</Label>
													<PropertyWithUndo property="topEffect">
														<Switch
															checked={draftItem.topEffect}
															onCheckedChange={(checked) => handlePropertyChange('topEffect', checked)}
														/>
													</PropertyWithUndo>
												</div>
											)}
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Always On Bottom</Label>
												<PropertyWithUndo property="isOnBottom">
													<Switch
														checked={draftItem.isOnBottom}
														onCheckedChange={(checked) => handlePropertyChange('isOnBottom', checked)}
													/>
												</PropertyWithUndo>
											</div>
											{showGroundBorder && (
												<div className="flex items-center justify-between">
													<Label className="text-xs text-muted-foreground">Ground Border</Label>
													<PropertyWithUndo property="isGroundBorder">
														<Switch
															checked={draftItem.isGroundBorder}
															onCheckedChange={(checked) => handlePropertyChange('isGroundBorder', checked)}
														/>
													</PropertyWithUndo>
												</div>
											)}
											{showFloorChange && (
												<div className="flex items-center justify-between">
													<Label className="text-xs text-muted-foreground">Floor Change</Label>
													<PropertyWithUndo property="floorChange">
														<Switch
															checked={draftItem.floorChange}
															onCheckedChange={(checked) => handlePropertyChange('floorChange', checked)}
														/>
													</PropertyWithUndo>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Animation Properties (10.50+) */}
								{showAnimationProperties && (
									<div>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Animation</h4>
										</div>
										<div className="space-y-2 pl-1">
											<div className="flex items-center justify-between pl-2 border-l-2 border-border/30">
												<Label className="text-[10px] text-muted-foreground">Is Animation</Label>
												<PropertyWithUndo property="isAnimation">
													<Switch
														checked={draftItem.isAnimation}
														onCheckedChange={(checked) => handlePropertyChange('isAnimation', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between pl-2 border-l-2 border-border/30">
												<Label className="text-[10px] text-muted-foreground">Mode</Label>
												<div className="flex items-center gap-2">
													<span className="text-[10px] text-muted-foreground">
														{draftItem.animationMode === 0 ? 'Async' : 'Sync'}
													</span>
													<PropertyWithUndo property="animationMode">
														<Switch
															checked={draftItem.animationMode === 1}
															onCheckedChange={(checked) => handlePropertyChange('animationMode', checked ? 1 : 0)}
														/>
													</PropertyWithUndo>
												</div>
											</div>
											<div className="flex items-center justify-between pl-2 border-l-2 border-border/30">
												<Label className="text-[10px] text-muted-foreground">Loop Count</Label>
												<PropertyWithUndo property="loopCount">
													<NumberInput
														className="h-7 w-16 text-right"
														value={draftItem.loopCount || 0}
														onChange={(val) => handlePropertyChange('loopCount', val)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between pl-2 border-l-2 border-border/30">
												<Label className="text-[10px] text-muted-foreground">Start Frame</Label>
												<PropertyWithUndo property="startFrame">
													<NumberInput
														className="h-7 w-16 text-right"
														value={draftItem.startFrame || 0}
														onChange={(val) => handlePropertyChange('startFrame', val)}
													/>
												</PropertyWithUndo>
											</div>
										</div>
									</div>
								)}

								{/* Fluids */}
								{isItem && (
									<div>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Fluids</h4>
										</div>
										<div className="space-y-3 pl-1">
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Fluid Container</Label>
												<PropertyWithUndo property="isFluidContainer">
													<Switch
														checked={draftItem.isFluidContainer}
														onCheckedChange={(checked) => handlePropertyChange('isFluidContainer', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Is Fluid</Label>
												<PropertyWithUndo property="isFluid">
													<Switch
														checked={draftItem.isFluid}
														onCheckedChange={(checked) => handlePropertyChange('isFluid', checked)}
													/>
												</PropertyWithUndo>
											</div>
										</div>
									</div>
								)}

								{/* Minimap - Show when top Visuals block is hidden or for outfits */}
								{showMinimap && (
									<div className={isOutfit ? '' : 'min-[1400px]:hidden'}>
										<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
											<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Minimap</h4>
										</div>
										<div className="space-y-2 pl-1">
											<div className="flex items-center justify-between">
												<Label className="text-xs text-muted-foreground">Show on Minimap</Label>
												<PropertyWithUndo property="miniMap">
													<Switch
														checked={draftItem.miniMap}
														onCheckedChange={(checked) => handlePropertyChange('miniMap', checked)}
													/>
												</PropertyWithUndo>
											</div>
											<div className="flex items-center justify-between pl-2 border-l-2 border-border/30">
												<Label className="text-[10px] text-muted-foreground">Color</Label>
												<EightBitColorPicker
													disabled={!draftItem.miniMap}
													value={draftItem.miniMapColor || 0}
													onChange={(val) => handlePropertyChange('miniMapColor', val)}
												/>
											</div>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</ScrollArea>

			{/* Footer with action buttons */}
			<div className="border-t border-border/50 bg-secondary/30 p-2 flex items-center gap-2 justify-between h-[45px]">
				<Button size="sm" className="h-7" variant="outline" disabled={!hasChanges} onClick={handleDiscardChanges}>
					<RotateCcw className="h-3.5 w-3.5 mr-1" />
					Discard Changes
				</Button>
				<div className="flex items-center gap-2">
					<Button size="sm" className="h-7" variant="outline" onClick={handleClose}>
						<X className="h-3.5 w-3.5 mr-1" />
						Close
					</Button>
					<Button size="sm" className="h-7" onClick={handleSave} disabled={!hasChanges}>
						<Save className="h-3.5 w-3.5 mr-1" />
						Save Changes
					</Button>
				</div>
			</div>

			{/* Confirmation dialog for closing with unsaved changes */}
			<AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
						<AlertDialogDescription>
							You have unsaved changes. Are you sure you want to close? All unsaved changes and state will be lost.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={performClose}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Close
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};
