const KEYWORDS = new Set([
	'and',
	'break',
	'do',
	'else',
	'elseif',
	'end',
	'false',
	'for',
	'function',
	'goto',
	'if',
	'in',
	'local',
	'nil',
	'not',
	'or',
	'repeat',
	'return',
	'then',
	'true',
	'until',
	'while'
]);

const BUILTINS = new Set([
	'assert',
	'collectgarbage',
	'dofile',
	'error',
	'getmetatable',
	'ipairs',
	'load',
	'loadfile',
	'next',
	'pairs',
	'pcall',
	'print',
	'rawequal',
	'rawget',
	'rawlen',
	'rawset',
	'require',
	'select',
	'setmetatable',
	'tonumber',
	'tostring',
	'type',
	'unpack',
	'xpcall',
	'string',
	'table',
	'math',
	'io',
	'os',
	'coroutine',
	'forge',
	'ffi'
]);

const TOKEN_RE =
	/(--\[\[[\s\S]*?(?:\]\]|$))|(--[^\n]*)|(\[\[[\s\S]*?(?:\]\]|$))|("(?:\\.|[^"\\\n])*"?)|('(?:\\.|[^'\\\n])*'?)|(\b(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b)|([A-Za-z_]\w*)/g;

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const highlightLua = (src: string): string => {
	let out = '';
	let last = 0;
	for (const m of src.matchAll(TOKEN_RE)) {
		const idx = m.index ?? 0;
		out += escapeHtml(src.slice(last, idx));
		const [text, mlComment, lnComment, mlString, dqString, sqString, num, ident] = m;
		let cls = '';
		if (mlComment || lnComment) cls = 'text-muted-foreground/70 italic';
		else if (mlString || dqString || sqString) cls = 'text-emerald-400';
		else if (num) cls = 'text-amber-400';
		else if (ident) {
			if (KEYWORDS.has(ident)) cls = 'text-violet-400 font-medium';
			else if (BUILTINS.has(ident)) cls = 'text-sky-400';
		}
		if (cls) out += `<span class="${cls}">${escapeHtml(text)}</span>`;
		else out += escapeHtml(text);
		last = idx + text.length;
	}
	out += escapeHtml(src.slice(last));
	return out + '\n';
};
