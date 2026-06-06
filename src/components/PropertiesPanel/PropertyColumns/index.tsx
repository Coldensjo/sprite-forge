import { Shuffle } from 'lucide-react';
import { MarketCategory } from '@/lib/tibia';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { TibiaColorPicker } from '@/components/TibiaColorPicker';
import { EightBitColorPicker } from '@/components/EightBitColorPicker';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from '@/components/ui/select';

import { usePropertiesContext } from '../context';
import { PropertyWithUndo } from '../PropertyWithUndo';

export const PropertyColumns = () => {
	const {
		item,
		isItem,
		isOutfit,
		draftItem,
		showHooks,
		outfitData,
		showMarket,
		showUsable,
		showWriting,
		showMinimap,
		showLensHelp,
		showHangable,
		showDontHide,
		setOutfitData,
		showEquipment,
		showTopEffect,
		showWrappable,
		showIgnoreLook,
		showHasCharges,
		showInteraction,
		showFloorChange,
		showTranslucent,
		showGroundBorder,
		showDisplacement,
		showAnimateAlways,
		showLayerPosition,
		showPhysicsGround,
		showDefaultActions,
		showNoMoveAnimation,
		handlePropertyChange,
		handleRandomizeColors,
		showAnimationProperties,
		showDisplacementElevation
	} = usePropertiesContext();

	return (
		<div className="bg-secondary/20 rounded-md border border-border/40 overflow-hidden mt-4">
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
				<div className="space-y-6">
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

					<div className={isOutfit ? '' : 'min-[1400px]:hidden'}>
						<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
							<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Light</h4>
						</div>
						<div className="space-y-2 pl-1">
							<div className="flex items-center justify-between">
								<Label className="text-xs text-muted-foreground">Has Light</Label>
								<PropertyWithUndo property="hasLight">
									<Switch checked={draftItem.hasLight} onCheckedChange={(checked) => handlePropertyChange('hasLight', checked)} />
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

				<div className="space-y-6">
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
											<Switch checked={draftItem.usable} onCheckedChange={(checked) => handlePropertyChange('usable', checked)} />
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

					{showEquipment && (
						<div>
							<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
								<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Equipment</h4>
							</div>
							<div className="space-y-2 pl-1">
								<div className="flex items-center justify-between">
									<Label className="text-xs text-muted-foreground">Is Cloth</Label>
									<PropertyWithUndo property="cloth">
										<Switch checked={draftItem.cloth} onCheckedChange={(checked) => handlePropertyChange('cloth', checked)} />
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

				<div className="space-y-6">
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
										<Switch checked={draftItem.isOnTop} onCheckedChange={(checked) => handlePropertyChange('isOnTop', checked)} />
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
										<span className="text-[10px] text-muted-foreground">{draftItem.animationMode === 0 ? 'Async' : 'Sync'}</span>
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
										<Switch checked={draftItem.isFluid} onCheckedChange={(checked) => handlePropertyChange('isFluid', checked)} />
									</PropertyWithUndo>
								</div>
							</div>
						</div>
					)}

					{showMinimap && (
						<div className={isOutfit ? '' : 'min-[1400px]:hidden'}>
							<div className="flex items-center gap-2 pb-1 mb-3 border-b border-border/30">
								<h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">Minimap</h4>
							</div>
							<div className="space-y-2 pl-1">
								<div className="flex items-center justify-between">
									<Label className="text-xs text-muted-foreground">Show on Minimap</Label>
									<PropertyWithUndo property="miniMap">
										<Switch checked={draftItem.miniMap} onCheckedChange={(checked) => handlePropertyChange('miniMap', checked)} />
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
	);
};
