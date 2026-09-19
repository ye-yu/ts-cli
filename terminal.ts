const ESC = '\u001b'

export type EraseDisplayMode = 'to-end' | 'to-start' | 'all' | 'saved-lines'
export type EraseLineMode = 'to-end' | 'to-start' | 'all'

export type TextStyle =
	| 'reset'
	| 'bold'
	| 'dim'
	| 'italic'
	| 'underline'
	| 'blink'
	| 'inverse'
	| 'hidden'
	| 'strikethrough'

const STYLE_CODE: Record<TextStyle, number> = {
	reset: 0,
	bold: 1,
	dim: 2,
	italic: 3,
	underline: 4,
	blink: 5,
	inverse: 7,
	hidden: 8,
	strikethrough: 9,
}

const ERASE_DISPLAY_CODE: Record<EraseDisplayMode, number> = {
	'to-end': 0,
	'to-start': 1,
	all: 2,
	'saved-lines': 3,
}

const ERASE_LINE_CODE: Record<EraseLineMode, number> = {
	'to-end': 0,
	'to-start': 1,
	all: 2,
}

export class TerminalRenderer {
	private readonly output: NodeJS.WriteStream
	private readonly chunks: string[] = []

	constructor(output: NodeJS.WriteStream = process.stdout) {
		this.output = output
	}

	static csi(command: string): string {
		return `${ESC}[${command}`
	}

	static osc(command: string): string {
		return `${ESC}]${command}`
	}

	static sgr(...codes: number[]): string {
		return TerminalRenderer.csi(`${codes.join(';')}m`)
	}

	private enqueue(sequence: string): this {
		this.chunks.push(sequence)
		return this
	}

	flush(): void {
		if (this.chunks.length === 0) return
		this.output.write(this.chunks.join(''))
		this.chunks.length = 0
	}

	raw(sequence: string): this {
		return this.enqueue(sequence)
	}

	text(value: string): this {
		return this.enqueue(value)
	}

	line(value = ''): this {
		return this.enqueue(`${value}\n`)
	}

	carriageReturn(): this {
		return this.enqueue('\r')
	}

	bell(): this {
		return this.enqueue('\x07')
	}

	moveTo(line: number, column: number): this {
		const safeLine = Math.max(1, Math.floor(line))
		const safeColumn = Math.max(1, Math.floor(column))
		return this.enqueue(TerminalRenderer.csi(`${safeLine};${safeColumn}H`))
	}

	moveUp(lines = 1): this {
		return this.enqueue(TerminalRenderer.csi(`${Math.max(1, Math.floor(lines))}A`))
	}

	moveDown(lines = 1): this {
		return this.enqueue(TerminalRenderer.csi(`${Math.max(1, Math.floor(lines))}B`))
	}

	moveRight(columns = 1): this {
		return this.enqueue(TerminalRenderer.csi(`${Math.max(1, Math.floor(columns))}C`))
	}

	moveLeft(columns = 1): this {
		return this.enqueue(TerminalRenderer.csi(`${Math.max(1, Math.floor(columns))}D`))
	}

	nextLine(lines = 1): this {
		return this.enqueue(TerminalRenderer.csi(`${Math.max(1, Math.floor(lines))}E`))
	}

	previousLine(lines = 1): this {
		return this.enqueue(TerminalRenderer.csi(`${Math.max(1, Math.floor(lines))}F`))
	}

	setColumn(column = 1): this {
		return this.enqueue(TerminalRenderer.csi(`${Math.max(1, Math.floor(column))}G`))
	}

	saveCursor(): this {
		return this.enqueue(`${ESC}7`)
	}

	restoreCursor(): this {
		return this.enqueue(`${ESC}8`)
	}

	hideCursor(): this {
		return this.enqueue(TerminalRenderer.csi('?25l'))
	}

	showCursor(): this {
		return this.enqueue(TerminalRenderer.csi('?25h'))
	}

	enableAlternateBuffer(): this {
		return this.enqueue(TerminalRenderer.csi('?1049h'))
	}

	disableAlternateBuffer(): this {
		return this.enqueue(TerminalRenderer.csi('?1049l'))
	}

	clearDisplay(mode: EraseDisplayMode = 'all'): this {
		return this.enqueue(TerminalRenderer.csi(`${ERASE_DISPLAY_CODE[mode]}J`))
	}

	clearLine(mode: EraseLineMode = 'all'): this {
		return this.enqueue(TerminalRenderer.csi(`${ERASE_LINE_CODE[mode]}K`))
	}

	style(...styles: TextStyle[]): this {
		if (styles.length === 0) return this
		const codes = styles.map((style) => STYLE_CODE[style])
		return this.enqueue(TerminalRenderer.sgr(...codes))
	}

	resetStyle(): this {
		return this.enqueue(TerminalRenderer.sgr(STYLE_CODE.reset))
	}

	fg(code: number): this {
		return this.enqueue(TerminalRenderer.sgr(Math.max(30, Math.min(97, Math.floor(code)))))
	}

	bg(code: number): this {
		return this.enqueue(TerminalRenderer.sgr(Math.max(40, Math.min(107, Math.floor(code)))))
	}

	fg256(colorId: number): this {
		const safeId = Math.max(0, Math.min(255, Math.floor(colorId)))
		return this.enqueue(TerminalRenderer.sgr(38, 5, safeId))
	}

	bg256(colorId: number): this {
		const safeId = Math.max(0, Math.min(255, Math.floor(colorId)))
		return this.enqueue(TerminalRenderer.sgr(48, 5, safeId))
	}

	fgRgb(r: number, g: number, b: number): this {
		return this.enqueue(TerminalRenderer.sgr(38, 2, this.clampRgb(r), this.clampRgb(g), this.clampRgb(b)))
	}

	bgRgb(r: number, g: number, b: number): this {
		return this.enqueue(TerminalRenderer.sgr(48, 2, this.clampRgb(r), this.clampRgb(g), this.clampRgb(b)))
	}

	writeStyled(text: string, styles: TextStyle[] = []): this {
		if (styles.length > 0) {
			this.style(...styles)
		}
		this.text(text)
		if (styles.length > 0) {
			this.resetStyle()
		}
		return this
	}

	async withHiddenCursor(work: () => Promise<void> | void): Promise<void> {
		this.hideCursor().flush()
		try {
			await work()
		} finally {
			this.showCursor().flush()
		}
	}

	private clampRgb(value: number): number {
		return Math.max(0, Math.min(255, Math.floor(value)))
	}
}

