import React from 'react';

import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { Switch } from '~/components/ui/switch';
import { Checkbox } from '~/components/ui/checkbox';
import { Separator } from '~/components/ui/separator';
import { VNode, CbRef, isCbRef } from '~/adapter/forge';

interface LuaDispatch {
	dispatch: (cbId: number, arg?: unknown) => void;
}

export const LuaCtx = React.createContext<LuaDispatch>({ dispatch: () => {} });

const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);

const useFire = (ref: unknown) => {
	const { dispatch } = React.useContext(LuaCtx);
	return (arg?: unknown) => {
		if (isCbRef(ref)) dispatch((ref as CbRef).__cb, arg);
	};
};

interface NodeProps {
	p: Record<string, unknown>;
	children?: React.ReactNode;
}

const Stack = (dir: 'col' | 'row'): React.FC<NodeProps> =>
	function StackImpl({ p, children }) {
		return (
			<div
				style={{ gap: num(p.gap, dir === 'col' ? 6 : 8) }}
				className={dir === 'col' ? 'flex flex-col' : 'flex flex-row items-center'}
			>
				{children}
			</div>
		);
	};

const NumberWidget: React.FC<NodeProps> = ({ p }) => {
	const fire = useFire(p.onChange);
	return <Input type="number" value={num(p.value)} onChange={(e) => fire(Number(e.target.value))} />;
};

const InputWidget: React.FC<NodeProps> = ({ p }) => {
	const fire = useFire(p.onChange);
	return <Input value={str(p.value)} placeholder={str(p.placeholder)} onChange={(e) => fire(e.target.value)} />;
};

const ButtonWidget: React.FC<NodeProps> = ({ p }) => {
	const fire = useFire(p.onClick);
	return (
		<Button size="sm" onClick={() => fire()} variant={str(p.variant, 'secondary') as never}>
			{str(p.label, 'Button')}
		</Button>
	);
};

const SwitchWidget: React.FC<NodeProps> = ({ p }) => {
	const fire = useFire(p.onChange);
	return (
		<label className="flex items-center gap-2 text-sm">
			<Switch checked={!!p.value} onCheckedChange={(v) => fire(!!v)} />
			{str(p.label)}
		</label>
	);
};

const CheckboxWidget: React.FC<NodeProps> = ({ p }) => {
	const fire = useFire(p.onChange);
	return (
		<label className="flex items-center gap-2 text-sm">
			<Checkbox checked={!!p.value} onCheckedChange={(v) => fire(!!v)} />
			{str(p.label)}
		</label>
	);
};

const REGISTRY: Record<string, React.FC<NodeProps>> = {
	input: InputWidget,
	button: ButtonWidget,
	switch: SwitchWidget,
	number: NumberWidget,
	vstack: Stack('col'),
	hstack: Stack('row'),
	checkbox: CheckboxWidget,
	separator: () => <Separator />,
	text: ({ p }) => <span className="text-sm">{str(p.text)}</span>,
	heading: ({ p }) => <h3 className="text-sm font-semibold">{str(p.text)}</h3>,
	label: ({ p }) => <Label className="text-muted-foreground">{str(p.text)}</Label>
};

const Unknown: React.FC<{ type: string }> = ({ type }) => (
	<div className="rounded border border-destructive/50 px-2 py-1 text-xs text-destructive">unknown widget: {type}</div>
);

export const renderNode = (node: VNode | string, key: React.Key): React.ReactNode => {
	if (typeof node === 'string') return <React.Fragment key={key}>{node}</React.Fragment>;
	if (!node || typeof node.type !== 'string') return null;
	const Comp = REGISTRY[node.type];
	const children = Array.isArray(node.children) ? node.children : [];
	const kids = children.map((c, i) => renderNode(c, i));
	if (!Comp) return <Unknown key={key} type={node.type} />;
	return (
		<Comp key={key} p={node.props || {}}>
			{kids}
		</Comp>
	);
};
