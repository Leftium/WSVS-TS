﻿/* (C) Stefan John / Stenway / WhitespaceSV.com / 2023 */

import { Base64String, InvalidUtf16StringError, ReliableTxtDocument, ReliableTxtEncoding, ReliableTxtLines, Utf16String } from "@stenway/reliabletxt"

// ----------------------------------------------------------------------

export class WsvParserError extends Error {
	readonly index: number
	readonly lineIndex: number
	readonly linePosition: number
	
	constructor(index: number, lineIndex: number, linePosition: number, message: string) {
		super(`${message} (${lineIndex+1}, ${linePosition+1})`)
		this.index = index
		this.lineIndex = lineIndex
		this.linePosition = linePosition
	}
}

// ----------------------------------------------------------------------

export abstract class WsvStringUtil {
	static validateWhitespaceStrings(values: (string | null)[] | null) {
		if (values !== null) {
			for (let i=0; i<values.length; i++) {
				const wsValue: string | null = values[i]
				if (wsValue === null) { continue }
				WsvStringUtil.validateWhitespaceString(wsValue, i===0)
			}
		}
	}

	static validateWhitespaceString(str: string, isFirst: boolean) {
		if (str.length === 0 && !isFirst) { throw new TypeError("Non-first whitespace string cannot be empty") }
		for (let i=0; i<str.length; i++) {
			const codeUnit: number = str.charCodeAt(i)
			switch (codeUnit) {
			case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
				continue
			default:
				throw new TypeError(`Invalid code unit '${codeUnit}' in whitespace string at index ${i}`)
			}
		}
	}

	static validateComment(value: string | null) {
		if (value !== null) {
			for (let i=0; i<value.length; i++) {
				const codeUnit: number = value.charCodeAt(i)
				if (codeUnit === 0x000A) { throw new RangeError("Line feed in comment is not allowed") }
				else if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
					i++
					if (codeUnit >= 0xDC00 || i >= value.length) { throw new InvalidUtf16StringError() }
					const secondCodeUnit: number = value.charCodeAt(i)
					if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
				}
			}
		}
	}
}

// ----------------------------------------------------------------------

export class WsvLine {
	values: (string | null)[]
	
	private _whitespaces: (string | null)[] | null = null
	private _comment: string | null = null

	get hasValues(): boolean {
		return this.values.length > 0
	}

	get whitespaces(): (string | null)[] | null {
		if (this._whitespaces === null) { return null }
		return [...this._whitespaces]
	}

	set whitespaces(values: (string | null)[] | null) {
		WsvStringUtil.validateWhitespaceStrings(values)
		if (values !== null) { this._whitespaces = [...values] }
		else { this._whitespaces = null}
	}

	get comment(): string | null {
		return this._comment
	}

	set comment(value: string | null) {
		WsvStringUtil.validateComment(value)
		this._comment = value
	}

	get hasComment(): boolean {
		return this._comment !== null
	}

	constructor(values: (string | null)[], whitespaces: (string | null)[] | null = null, comment: string | null = null) {
		this.values = values
		this.whitespaces = whitespaces
		this.comment = comment
	}

	set(values: (string | null)[], whitespaces: (string | null)[] | null = null, comment: string | null = null) {
		this.values = values
		this.whitespaces = whitespaces
		this.comment = comment
	}
	
	toString(preserveWhitespaceAndComment: boolean = true): string {
		if (preserveWhitespaceAndComment) {
			return WsvSerializer.internalSerializeValuesWhitespacesAndComment(this.values, this._whitespaces, this._comment)
		} else {
			return WsvSerializer.serializeValues(this.values)
		}
	}
	
	static internal(values: (string | null)[], whitespaces: (string | null)[] | null, comment: string | null): WsvLine {
		const line: WsvLine = new WsvLine(values)
		line._whitespaces = whitespaces
		line._comment = comment
		return line
	}

	static internalWhitespaces(line: WsvLine): (string | null)[] | null {
		return line._whitespaces
	}

	static parse(str: string, preserveWhitespacesAndComments: boolean = true) {
		return WsvParser.parseLine(str, preserveWhitespacesAndComments)
	}

	static parseAsArray(str: string): (string | null)[] {
		return WsvParser.parseLine(str, false).values
	}

	static serialize(values: (string | null)[]): string {
		return WsvSerializer.serializeValues(values)
	}
}

// ----------------------------------------------------------------------

export class WsvDocument {
	lines: WsvLine[]
	encoding: ReliableTxtEncoding

	constructor(lines: WsvLine[] = [], encoding: ReliableTxtEncoding = ReliableTxtEncoding.Utf8) {
		this.lines = lines
		this.encoding = encoding
	}

	addLine(values: (string | null)[], whitespaces: (string | null)[] | null = null, comment: string | null = null) {
		const line: WsvLine = new WsvLine(values, whitespaces, comment)
		this.lines.push(line)
	}

	toJaggedArray(): (string | null)[][] {
		const array: (string | null)[][] = []
		for (const line of this.lines) {
			array.push(line.values)
		}
		return array
	}

	toString(preserveWhitespaceAndComment: boolean = true): string {
		return WsvSerializer.serializeLines(this.lines, preserveWhitespaceAndComment)
	}

	getBytes(preserveWhitespacesAndComments: boolean = true): Uint8Array {
		const str: string = this.toString(preserveWhitespacesAndComments)
		return new ReliableTxtDocument(str, this.encoding).getBytes()
	}

	toBase64String(preserveWhitespacesAndComments: boolean = true): string {
		const str: string = this.toString(preserveWhitespacesAndComments)
		return Base64String.fromText(str, this.encoding)
	}

	toBinaryWsv(): Uint8Array {
		return BinaryWsvEncoder.encode(this)
	}

	static parse(str: string, preserveWhitespacesAndComments: boolean = true, encoding: ReliableTxtEncoding = ReliableTxtEncoding.Utf8) {
		const lines = WsvParser.parseLines(str, preserveWhitespacesAndComments)
		return new WsvDocument(lines, encoding)
	}

	static parseAsJaggedArray(str: string): (string | null)[][] {
		return WsvParser.parseAsJaggedArray(str)
	}

	static fromJaggedArray(jaggedArray: (string | null)[][], encoding: ReliableTxtEncoding = ReliableTxtEncoding.Utf8): WsvDocument {
		const document = new WsvDocument()
		for (const values of jaggedArray) {
			document.addLine(values)
		}
		document.encoding = encoding
		return document
	}

	static fromBytes(bytes: Uint8Array, preserveWhitespacesAndComments: boolean = true): WsvDocument {
		const txtDocument = ReliableTxtDocument.fromBytes(bytes)
		const document = WsvDocument.parse(txtDocument.text, preserveWhitespacesAndComments, txtDocument.encoding)
		return document
	}

	static fromLines(lines: string[], preserveWhitespacesAndComments: boolean = true, encoding: ReliableTxtEncoding = ReliableTxtEncoding.Utf8) {
		const content = ReliableTxtLines.join(lines)
		const document = WsvDocument.parse(content, preserveWhitespacesAndComments, encoding)
		return document
	}

	static fromBase64String(base64Str: string): WsvDocument {
		const bytes = Base64String.toBytes(base64Str)
		return this.fromBytes(bytes)
	}

	static fromBinaryWsv(bytes: Uint8Array): WsvDocument {
		return BinaryWsvDecoder.decode(bytes)
	}
}

// ----------------------------------------------------------------------

export abstract class WsvValue {
	private static containsSpecialChar(value: string): boolean {
		for (let i=0; i<value.length; i++) {
			const c: number = value.charCodeAt(i)
			switch (c) {
			case 0x0022:
			case 0x0023:
			case 0x000A:
			case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
				return true
			}
			if (c >= 0xD800 && c <= 0xDFFF) {
				i++
				if (c >= 0xDC00 || i >= value.length) { throw new InvalidUtf16StringError() }
				const secondCodeUnit: number = value.charCodeAt(i)
				if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
			}
		}
		return false
	}

	static isSpecial(value: string | null): boolean {
		if (value === null || value.length === 0 || value === "-" || WsvValue.containsSpecialChar(value)) { return true }
		else { return false }
	}
	
	static serialize(value: string | null): string {
		if (value === null) {
			return "-"
		} else if (value.length === 0) {
			return "\"\""
		} else if (value === "-") {
			return "\"-\""
		} else if (WsvValue.containsSpecialChar(value)) {
			let size: number = 2
			for (let i=0; i<value.length; i++) {
				const codeUnit: number = value.charCodeAt(i)
				switch (codeUnit) {
				case 0x000A:
					size += 3
					break
				case 0x0022:
					size += 2
					break
				default:
					size++
				}
			}
			const bytes: Uint8Array = new Uint8Array(size*2)
			const view: DataView = new DataView(bytes.buffer)
			view.setUint16(0, 0x0022, false)
			let index: number = 2
			for (let i=0; i<value.length; i++) {
				const codeUnit: number = value.charCodeAt(i)
				switch (codeUnit) {
				case 0x000A:
					view.setUint16(index, 0x0022, false)
					index += 2
					view.setUint16(index, 0x002F, false)
					index += 2
					view.setUint16(index, 0x0022, false)
					index += 2
					break
				case 0x0022:
					view.setUint16(index, 0x0022, false)
					index += 2
					view.setUint16(index, 0x0022, false)
					index += 2
					break
				default:
					view.setUint16(index, codeUnit, false)
					index += 2
				}
			}
			view.setUint16(index, 0x0022, false)
			return Utf16String.fromUtf16Bytes(bytes, false, false)
		} else {
			return value
		}
	}

	static parse(str: string, allowWhitespaceAndComment: boolean = false): string | null {
		// TODO optimize
		const line = WsvParser.parseLine(str, true)
		if (line.values.length === 0) { throw new Error("No value")}
		else if (line.values.length > 1) { throw new Error("Multiple values")}
		if (!allowWhitespaceAndComment) {
			if (line.hasComment) {
				throw new Error("Comment not allowed")
			}
			const whitespaces = WsvLine.internalWhitespaces(line)
			if (whitespaces !== null && whitespaces.length > 0 && (whitespaces[0] !== null || whitespaces.length > 1)) {
				throw new Error("Whitespace not allowed")
			}
		}
		return line.values[0]
	}
}

// ----------------------------------------------------------------------

export abstract class WsvSerializer {
	static serializeValues(values: (string | null)[]): string {
		const strings: string[] = []
		for (let i=0; i<values.length; i++) {
			if (i !== 0) { strings.push(" ") }
			const serialized: string = WsvValue.serialize(values[i])
			strings.push(serialized)
		}
		return strings.join("")
	}

	static serializeJaggedArray(jaggedArray: (string | null)[][]): string {
		const lines: string[] = []
		for (const values of jaggedArray) {
			const line: string = WsvSerializer.serializeValues(values)
			lines.push(line)
		}
		return ReliableTxtLines.join(lines)
	}

	static internalSerializeValuesWhitespacesAndComment(values: (string | null)[], whitespaces: (string | null)[] | null, comment: string | null): string {
		const strings: string[] = []
		whitespaces ??= []
		for (let i=0; i<values.length; i++) {
			let whitespace: string | null = i < whitespaces.length ? whitespaces[i] : null
			whitespace ??= i !== 0 ? " " : ""
			strings.push(whitespace)
			const serialized: string = WsvValue.serialize(values[i])
			strings.push(serialized)
		}
		if (whitespaces.length > values.length) { strings.push(whitespaces[values.length] ?? "") }
		else if (comment !== null && values.length > 0 && values.length >= whitespaces.length) { strings.push(" ") }

		if (comment !== null) { strings.push("#"+comment) }
		return strings.join("")
	}

	static serializeLines(lines: WsvLine[], preserveWhitespaceAndComment: boolean = true): string {
		const lineStrings: string[] = []
		for (const line of lines) {
			lineStrings.push(line.toString(preserveWhitespaceAndComment))
		}
		return ReliableTxtLines.join(lineStrings)
	}
}

// ----------------------------------------------------------------------

export abstract class WsvParser {
	private static readonly stringNotClosed: string					= "String not closed"
	private static readonly invalidStringLineBreak: string			= "Invalid string line break"
	private static readonly invalidCharacterAfterString: string		= "Invalid character after string"
	private static readonly invalidDoubleQuoteInValue: string		= "Invalid double quote in value"

	static parseLine(str: string, preserveWhitespacesAndComments: boolean, lineIndexOffset: number = 0): WsvLine {
		const lines: WsvLine[] = WsvParser.parseLines(str, preserveWhitespacesAndComments, lineIndexOffset)
		if (lines.length !== 1) { throw new Error("Multiple WSV lines not allowed")}
		return lines[0]
	}
	
	static parseLines(str: string, preserveWhitespacesAndComments: boolean, lineIndexOffset: number = 0): WsvLine[] {
		if (preserveWhitespacesAndComments) { return WsvParser.parseLinesPreserving(str, lineIndexOffset) }
		else { return WsvParser.parseLinesNonPreserving(str, lineIndexOffset) }
	}

	private static getError(message: string, lineIndex: number, lineStartIndex: number, index: number): Error {
		return new WsvParserError(index, lineIndex, index-lineStartIndex, message)
	}

	private static parseLinesPreserving(str: string, lineIndexOffset: number): WsvLine[] {
		const lines: WsvLine[] = []
		let index: number = 0
		let startIndex: number = 0
		
		let values: (string | null)[]
		let whitespaces: (string | null)[]
		let comment: string | null

		let codeUnit: number
		let lineIndex: number = lineIndexOffset - 1
		let lineStartIndex: number
		lineLoop: for (;;) {
			lineIndex++
			lineStartIndex = index

			values = []
			whitespaces = []
			comment = null
			for (;;) {
				if (index >= str.length) {
					lines.push(WsvLine.internal(values, whitespaces, comment))
					break lineLoop
				}
				codeUnit = str.charCodeAt(index)
				startIndex = index
				wsLoop: for (;;) {
					switch (codeUnit) {
					case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
						index++
						if (index >= str.length) { break wsLoop }
						codeUnit = str.charCodeAt(index)
						break
					default:
						break wsLoop
					}
				}
				if (index > startIndex) {
					const whitespace: string = str.substring(startIndex, index)
					whitespaces.push(whitespace)
					if (index >= str.length) {
						lines.push(WsvLine.internal(values, whitespaces, comment))
						break lineLoop
					}
					startIndex = index
				} else { whitespaces.push(null) }
				switch (codeUnit) {
				case 0x000A:
					lines.push(WsvLine.internal(values, whitespaces, comment))
					index++
					continue lineLoop
				case 0x0023: {
					index++
					startIndex = index
					comment = ""
					let wasLineBreak: boolean = false
					commentLoop: for (;;) {
						if (index >= str.length) { break commentLoop }
						codeUnit = str.charCodeAt(index)
						index++
						if (codeUnit === 0x000A) {
							wasLineBreak = true
							break commentLoop
						} else if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
							if (codeUnit >= 0xDC00 || index >= str.length) { throw new InvalidUtf16StringError() }
							const secondCodeUnit: number = str.charCodeAt(index)
							if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
							index++
						}
					}
					if (wasLineBreak && index-1 > startIndex) {
						comment = str.substring(startIndex, index-1)
					} else if (!wasLineBreak && index > startIndex) {
						comment = str.substring(startIndex, index)
					}
					lines.push(WsvLine.internal(values, whitespaces, comment))
					if (index >= str.length && !wasLineBreak) { break lineLoop }
					else { continue lineLoop }
				}}

				if (codeUnit === 0x0022) {
					index++
					const strCodeUnits: string[] = []
					stringCharLoop: for (;;) {
						if (index >= str.length) { throw WsvParser.getError(WsvParser.stringNotClosed, lineIndex, lineStartIndex, index) }
						codeUnit = str.charCodeAt(index)
						index++
						switch (codeUnit) {
						case 0x000A:
							throw WsvParser.getError(WsvParser.stringNotClosed, lineIndex, lineStartIndex, index-1)
						case 0x0022:
							if (index >= str.length) { break stringCharLoop }
							codeUnit = str.charCodeAt(index)
							switch (codeUnit) {
							case 0x0022:
								strCodeUnits.push("\"")
								index++
								break
							case 0x000A:
							case 0x0023:
							case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
								break stringCharLoop
							case 0x002F:
								index++
								if (index >= str.length) { throw WsvParser.getError(WsvParser.invalidStringLineBreak, lineIndex, lineStartIndex, index) }
								codeUnit = str.charCodeAt(index)
								if (codeUnit !== 0x0022) { throw WsvParser.getError(WsvParser.invalidStringLineBreak, lineIndex, lineStartIndex, index) }
								strCodeUnits.push("\n")
								index++
								break
							default:
								throw WsvParser.getError(WsvParser.invalidCharacterAfterString, lineIndex, lineStartIndex, index)
							}
							break
						default:
							strCodeUnits.push(String.fromCharCode(codeUnit))
							if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
								if (codeUnit >= 0xDC00 || index >= str.length) { throw new InvalidUtf16StringError() }
								const secondCodeUnit: number = str.charCodeAt(index)
								if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
								strCodeUnits.push(String.fromCharCode(secondCodeUnit))
								index++
							}
							break
						}
					}
					values.push(strCodeUnits.join(""))
				} else {
					valueCharLoop: for (;;) {
						switch (codeUnit) {
						case 0x000A:
						case 0x0023:
						case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
							break valueCharLoop
						case 0x0022:
							throw WsvParser.getError(WsvParser.invalidDoubleQuoteInValue, lineIndex, lineStartIndex, index)
						}
						if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
							index++
							if (codeUnit >= 0xDC00 || index >= str.length) { throw new InvalidUtf16StringError() }
							const secondCodeUnit: number = str.charCodeAt(index)
							if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
						}
						index++
						if (index >= str.length) { break valueCharLoop }
						codeUnit = str.charCodeAt(index)
					}
					let value: string | null = str.substring(startIndex, index)
					if (value.length === 1 && value.charCodeAt(0) === 0x002D) { value = null }
					values.push(value)
				}
			}
		}
		return lines
	}

	private static parseLinesNonPreserving(str: string, lineIndexOffset: number): WsvLine[] {
		const lines: WsvLine[] = []
		let index: number = 0
		let startIndex: number = 0
		
		let values: (string | null)[]
		
		let codeUnit: number
		let lineIndex: number = lineIndexOffset - 1
		let lineStartIndex: number
		lineLoop: for (;;) {
			lineIndex++
			lineStartIndex = index

			values = []
			for (;;) {
				if (index >= str.length) {
					lines.push(new WsvLine(values))
					break lineLoop
				}
				codeUnit = str.charCodeAt(index)
				startIndex = index
				wsLoop: for (;;) {
					switch (codeUnit) {
					case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
						index++
						if (index >= str.length) { break wsLoop }
						codeUnit = str.charCodeAt(index)
						break
					default:
						break wsLoop
					}
				}
				if (index > startIndex) {
					if (index >= str.length) {
						lines.push(new WsvLine(values))
						break lineLoop
					}
					startIndex = index
				}
				switch (codeUnit) {
				case 0x000A:
					lines.push(new WsvLine(values))
					index++
					continue lineLoop
				case 0x0023: {
					index++
					startIndex = index
					let wasLineBreak: boolean = false
					commentLoop: for (;;) {
						if (index >= str.length) { break commentLoop }
						codeUnit = str.charCodeAt(index)
						index++
						if (codeUnit === 0x000A) {
							wasLineBreak = true
							break commentLoop
						} else if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
							if (codeUnit >= 0xDC00 || index >= str.length) { throw new InvalidUtf16StringError() }
							const secondCodeUnit: number = str.charCodeAt(index)
							if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
							index++
						}
					}
					lines.push(new WsvLine(values))
					if (index >= str.length && !wasLineBreak) { break lineLoop }
					else { continue lineLoop }
				}}

				if (codeUnit === 0x0022) {
					index++
					const strCodeUnits: string[] = []
					stringCharLoop: for (;;) {
						if (index >= str.length) { throw WsvParser.getError(WsvParser.stringNotClosed, lineIndex, lineStartIndex, index) }
						codeUnit = str.charCodeAt(index)
						index++
						switch (codeUnit) {
						case 0x000A:
							throw WsvParser.getError(WsvParser.stringNotClosed, lineIndex, lineStartIndex, index-1)
						case 0x0022:
							if (index >= str.length) { break stringCharLoop }
							codeUnit = str.charCodeAt(index)
							switch (codeUnit) {
							case 0x0022:
								strCodeUnits.push("\"")
								index++
								break
							case 0x000A:
							case 0x0023:
							case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
								break stringCharLoop
							case 0x002F:
								index++
								if (index >= str.length) { throw WsvParser.getError(WsvParser.invalidStringLineBreak, lineIndex, lineStartIndex, index) }
								codeUnit = str.charCodeAt(index)
								if (codeUnit !== 0x0022) { throw WsvParser.getError(WsvParser.invalidStringLineBreak, lineIndex, lineStartIndex, index) }
								strCodeUnits.push("\n")
								index++
								break
							default:
								throw WsvParser.getError(WsvParser.invalidCharacterAfterString, lineIndex, lineStartIndex, index)
							}
							break
						default:
							strCodeUnits.push(String.fromCharCode(codeUnit))
							if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
								if (codeUnit >= 0xDC00 || index >= str.length) { throw new InvalidUtf16StringError() }
								const secondCodeUnit: number = str.charCodeAt(index)
								if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
								strCodeUnits.push(String.fromCharCode(secondCodeUnit))
								index++
							}
							break
						}
					}
					values.push(strCodeUnits.join(""))
				} else {
					valueCharLoop: for (;;) {
						switch (codeUnit) {
						case 0x000A:
						case 0x0023:
						case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
							break valueCharLoop
						case 0x0022:
							throw WsvParser.getError(WsvParser.invalidDoubleQuoteInValue, lineIndex, lineStartIndex, index)
						}
						if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
							index++
							if (codeUnit >= 0xDC00 || index >= str.length) { throw new InvalidUtf16StringError() }
							const secondCodeUnit: number = str.charCodeAt(index)
							if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
						}
						index++
						if (index >= str.length) { break valueCharLoop }
						codeUnit = str.charCodeAt(index)
					}
					let value: string | null = str.substring(startIndex, index)
					if (value.length === 1 && value.charCodeAt(0) === 0x002D) { value = null }
					values.push(value)
				}
			}
		}
		return lines
	}

	static parseAsJaggedArray(str: string, lineIndexOffset: number = 0): (string | null)[][] {
		const lines: (string | null)[][] = []
		let index: number = 0
		let startIndex: number = 0
		
		let values: (string | null)[]
		
		let codeUnit: number
		let lineIndex: number = lineIndexOffset - 1
		let lineStartIndex: number
		lineLoop: for (;;) {
			lineIndex++
			lineStartIndex = index

			values = []
			for (;;) {
				if (index >= str.length) {
					lines.push(values)
					break lineLoop
				}
				codeUnit = str.charCodeAt(index)
				startIndex = index
				wsLoop: for (;;) {
					switch (codeUnit) {
					case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
						index++
						if (index >= str.length) { break wsLoop }
						codeUnit = str.charCodeAt(index)
						break
					default:
						break wsLoop
					}
				}
				if (index > startIndex) {
					if (index >= str.length) {
						lines.push(values)
						break lineLoop
					}
					startIndex = index
				}
				switch (codeUnit) {
				case 0x000A:
					lines.push(values)
					index++
					continue lineLoop
				case 0x0023: {
					index++
					startIndex = index
					let wasLineBreak: boolean = false
					commentLoop: for (;;) {
						if (index >= str.length) { break commentLoop }
						codeUnit = str.charCodeAt(index)
						index++
						if (codeUnit === 0x000A) {
							wasLineBreak = true
							break commentLoop
						} else if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
							if (codeUnit >= 0xDC00 || index >= str.length) { throw new InvalidUtf16StringError() }
							const secondCodeUnit: number = str.charCodeAt(index)
							if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
							index++
						}
					}
					lines.push(values)
					if (index >= str.length && !wasLineBreak) { break lineLoop }
					else { continue lineLoop }
				}}

				if (codeUnit === 0x0022) {
					index++
					const strCodeUnits: string[] = []
					stringCharLoop: for (;;) {
						if (index >= str.length) { throw WsvParser.getError(WsvParser.stringNotClosed, lineIndex, lineStartIndex, index) }
						codeUnit = str.charCodeAt(index)
						index++
						switch (codeUnit) {
						case 0x000A:
							throw WsvParser.getError(WsvParser.stringNotClosed, lineIndex, lineStartIndex, index-1)
						case 0x0022:
							if (index >= str.length) { break stringCharLoop }
							codeUnit = str.charCodeAt(index)
							switch (codeUnit) {
							case 0x0022:
								strCodeUnits.push("\"")
								index++
								break
							case 0x000A:
							case 0x0023:
							case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
								break stringCharLoop
							case 0x002F:
								index++
								if (index >= str.length) { throw WsvParser.getError(WsvParser.invalidStringLineBreak, lineIndex, lineStartIndex, index) }
								codeUnit = str.charCodeAt(index)
								if (codeUnit !== 0x0022) { throw WsvParser.getError(WsvParser.invalidStringLineBreak, lineIndex, lineStartIndex, index) }
								strCodeUnits.push("\n")
								index++
								break
							default:
								throw WsvParser.getError(WsvParser.invalidCharacterAfterString, lineIndex, lineStartIndex, index)
							}
							break
						default:
							strCodeUnits.push(String.fromCharCode(codeUnit))
							if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
								if (codeUnit >= 0xDC00 || index >= str.length) { throw new InvalidUtf16StringError() }
								const secondCodeUnit: number = str.charCodeAt(index)
								if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
								strCodeUnits.push(String.fromCharCode(secondCodeUnit))
								index++
							}
							break
						}
					}
					values.push(strCodeUnits.join(""))
				} else {
					valueCharLoop: for (;;) {
						switch (codeUnit) {
						case 0x000A:
						case 0x0023:
						case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
							break valueCharLoop
						case 0x0022:
							throw WsvParser.getError(WsvParser.invalidDoubleQuoteInValue, lineIndex, lineStartIndex, index)
						}
						if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
							index++
							if (codeUnit >= 0xDC00 || index >= str.length) { throw new InvalidUtf16StringError() }
							const secondCodeUnit: number = str.charCodeAt(index)
							if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
						}
						index++
						if (index >= str.length) { break valueCharLoop }
						codeUnit = str.charCodeAt(index)
					}
					let value: string | null = str.substring(startIndex, index)
					if (value.length === 1 && value.charCodeAt(0) === 0x002D) { value = null }
					values.push(value)
				}
			}
		}
		return lines
	}
}

// ----------------------------------------------------------------------

export abstract class VarInt56Encoder {
	static encode(i: number): Uint8Array {
		if (i < 0 || !Number.isInteger(i)) { throw new RangeError() }

		if (i < 2 ** 6) { 
			const codePoint1 = (i << 1) + 1
			return new Uint8Array([codePoint1])
		} else if (i < 2 ** 12) {
			const codePoint1 = ((i & 0b11111_0000000) >> 5) | 0b10
			const codePoint2 = i & 0b1111111
			return new Uint8Array([codePoint1, codePoint2])
		} else if (i < 2 ** 18) {
			const codePoint1 = ((i & 0b1111_0000000_0000000) >> 11) | 0b100
			const codePoint2 = (i & 0b1111111_0000000) >> 7
			const codePoint3 = i & 0b1111111
			return new Uint8Array([codePoint1, codePoint2, codePoint3])
		} else if (i < 2 ** 24) {
			const codePoint1 = ((i & 0b111_0000000_0000000_0000000) >> 17) | 0b1000
			const codePoint2 = (i & 0b1111111_0000000_0000000) >> 14
			const codePoint3 = (i & 0b1111111_0000000) >> 7
			const codePoint4 = i & 0b1111111
			return new Uint8Array([codePoint1, codePoint2, codePoint3, codePoint4])
		} else if (i < 2 ** 30) {
			const codePoint1 = ((i & 0b11_0000000_0000000_0000000_0000000) >> 23) | 0b10000
			const codePoint2 = (i & 0b1111111_0000000_0000000_0000000) >> 21
			const codePoint3 = (i & 0b1111111_0000000_0000000) >> 14
			const codePoint4 = (i & 0b1111111_0000000) >> 7
			const codePoint5 = i & 0b1111111
			return new Uint8Array([codePoint1, codePoint2, codePoint3, codePoint4, codePoint5])
		} else if (i < 2 ** 36) {
			const bI = BigInt(i)
			const codePoint1 = ((bI & 0b1_0000000_0000000_0000000_0000000_0000000n) >> 29n) | 0b100000n
			const codePoint2 = (bI & 0b1111111_0000000_0000000_0000000_0000000n) >> 28n
			const codePoint3 = (i & 0b1111111_0000000_0000000_0000000) >> 21
			const codePoint4 = (i & 0b1111111_0000000_0000000) >> 14
			const codePoint5 = (i & 0b1111111_0000000) >> 7
			const codePoint6 = i & 0b1111111
			return new Uint8Array([Number(codePoint1), Number(codePoint2), codePoint3, codePoint4, codePoint5, codePoint6])
		} else if (i < 2 ** 42) {
			const bI = BigInt(i)
			const codePoint2 = (bI & 0b1111111_0000000_0000000_0000000_0000000_0000000n) >> 35n
			const codePoint3 = (bI & 0b1111111_0000000_0000000_0000000_0000000n) >> 28n
			const codePoint4 = (i & 0b1111111_0000000_0000000_0000000) >> 21
			const codePoint5 = (i & 0b1111111_0000000_0000000) >> 14
			const codePoint6 = (i & 0b1111111_0000000) >> 7
			const codePoint7 = i & 0b1111111
			return new Uint8Array([0b1000000, Number(codePoint2), Number(codePoint3), codePoint4, codePoint5, codePoint6, codePoint7])
		} else if (i <= Number.MAX_SAFE_INTEGER) {
			const bI = BigInt(i)
			const codePoint2 = (bI & 0b1111111_0000000_0000000_0000000_0000000_0000000_0000000_0000000n) >> 49n
			const codePoint3 = (bI & 0b1111111_0000000_0000000_0000000_0000000_0000000_0000000n) >> 42n
			const codePoint4 = (bI & 0b1111111_0000000_0000000_0000000_0000000_0000000n) >> 35n
			const codePoint5 = (bI & 0b1111111_0000000_0000000_0000000_0000000n) >> 28n
			const codePoint6 = (i & 0b1111111_0000000_0000000_0000000) >> 21
			const codePoint7 = (i & 0b1111111_0000000_0000000) >> 14
			const codePoint8 = (i & 0b1111111_0000000) >> 7
			const codePoint9 = i & 0b1111111
			return new Uint8Array([0, Number(codePoint2), Number(codePoint3), Number(codePoint4), Number(codePoint5), codePoint6, codePoint7, codePoint8, codePoint9])
		} else { throw new Error("Not supported") }
	}

	static encodeIntoBuffer(i: number, buffer: Uint8Array, offset: number): number {
		if (i < 0 || !Number.isInteger(i)) { throw new RangeError() }

		if (i < 2 ** 6) { 
			if (offset >= buffer.length) { throw new RangeError() }
			buffer[offset] = (i << 1) + 1
			return 1
		} else if (i < 2 ** 12) {
			if (offset + 1 >= buffer.length) { throw new RangeError() }
			buffer[offset] = ((i & 0b11111_0000000) >> 5) | 0b10
			buffer[offset+1] = i & 0b1111111
			return 2
		} else if (i < 2 ** 18) {
			if (offset + 2 >= buffer.length) { throw new RangeError() }
			buffer[offset] = ((i & 0b1111_0000000_0000000) >> 11) | 0b100
			buffer[offset+1] = (i & 0b1111111_0000000) >> 7
			buffer[offset+2] = i & 0b1111111
			return 3
		} else if (i < 2 ** 24) {
			if (offset + 3 >= buffer.length) { throw new RangeError() }
			buffer[offset] = ((i & 0b111_0000000_0000000_0000000) >> 17) | 0b1000
			buffer[offset+1] = (i & 0b1111111_0000000_0000000) >> 14
			buffer[offset+2] = (i & 0b1111111_0000000) >> 7
			buffer[offset+3] = i & 0b1111111
			return 4
		} else if (i < 2 ** 30) {
			if (offset + 4 >= buffer.length) { throw new RangeError() }
			buffer[offset] = ((i & 0b11_0000000_0000000_0000000_0000000) >> 23) | 0b10000
			buffer[offset+1] = (i & 0b1111111_0000000_0000000_0000000) >> 21
			buffer[offset+2] = (i & 0b1111111_0000000_0000000) >> 14
			buffer[offset+3] = (i & 0b1111111_0000000) >> 7
			buffer[offset+4] = i & 0b1111111
			return 5
		} else if (i < 2 ** 36) {
			if (offset + 5 >= buffer.length) { throw new RangeError() }
			const bI = BigInt(i)
			buffer[offset] = Number(((bI & 0b1_0000000_0000000_0000000_0000000_0000000n) >> 29n) | 0b100000n)
			buffer[offset+1] = Number((bI & 0b1111111_0000000_0000000_0000000_0000000n) >> 28n)
			buffer[offset+2] = (i & 0b1111111_0000000_0000000_0000000) >> 21
			buffer[offset+3] = (i & 0b1111111_0000000_0000000) >> 14
			buffer[offset+4] = (i & 0b1111111_0000000) >> 7
			buffer[offset+5] = i & 0b1111111
			return 6
		} else if (i < 2 ** 42) {
			if (offset + 6 >= buffer.length) { throw new RangeError() }
			const bI = BigInt(i)
			buffer[offset] = 0b1000000
			buffer[offset+1] = Number((bI & 0b1111111_0000000_0000000_0000000_0000000_0000000n) >> 35n)
			buffer[offset+2] = Number((bI & 0b1111111_0000000_0000000_0000000_0000000n) >> 28n)
			buffer[offset+3] = (i & 0b1111111_0000000_0000000_0000000) >> 21
			buffer[offset+4] = (i & 0b1111111_0000000_0000000) >> 14
			buffer[offset+5] = (i & 0b1111111_0000000) >> 7
			buffer[offset+6] = i & 0b1111111
			return 7
		} else if (i <= Number.MAX_SAFE_INTEGER) {
			if (offset + 8 >= buffer.length) { throw new RangeError() }
			const bI = BigInt(i)
			buffer[offset] = 0
			buffer[offset+1] = Number((bI & 0b1111111_0000000_0000000_0000000_0000000_0000000_0000000_0000000n) >> 49n)
			buffer[offset+2] = Number((bI & 0b1111111_0000000_0000000_0000000_0000000_0000000_0000000n) >> 42n)
			buffer[offset+3] = Number((bI & 0b1111111_0000000_0000000_0000000_0000000_0000000n) >> 35n)
			buffer[offset+4] = Number((bI & 0b1111111_0000000_0000000_0000000_0000000n) >> 28n)
			buffer[offset+5] = (i & 0b1111111_0000000_0000000_0000000) >> 21
			buffer[offset+6] = (i & 0b1111111_0000000_0000000) >> 14
			buffer[offset+7] = (i & 0b1111111_0000000) >> 7
			buffer[offset+8] = i & 0b1111111
			return 9
		} else { throw new Error("Not supported") }
	}

	static encodeAsString(i: number): string {
		if (i < 0 || !Number.isInteger(i)) { throw new RangeError() }

		if (i < 2 ** 6) { 
			return String.fromCodePoint((i << 1) + 1)
		} else if (i < 2 ** 12) {
			const codePoint1 = ((i & 0b11111_0000000) >> 5) | 0b10
			const codePoint2 = i & 0b1111111
			return String.fromCodePoint(codePoint1, codePoint2)
		} else if (i < 2 ** 18) {
			const codePoint1 = ((i & 0b1111_0000000_0000000) >> 11) | 0b100
			const codePoint2 = (i & 0b1111111_0000000) >> 7
			const codePoint3 = i & 0b1111111
			return String.fromCodePoint(codePoint1, codePoint2, codePoint3)
		} else if (i < 2 ** 24) {
			const codePoint1 = ((i & 0b111_0000000_0000000_0000000) >> 17) | 0b1000
			const codePoint2 = (i & 0b1111111_0000000_0000000) >> 14
			const codePoint3 = (i & 0b1111111_0000000) >> 7
			const codePoint4 = i & 0b1111111
			return String.fromCodePoint(codePoint1, codePoint2, codePoint3, codePoint4)
		} else if (i < 2 ** 30) {
			const codePoint1 = ((i & 0b11_0000000_0000000_0000000_0000000) >> 23) | 0b10000
			const codePoint2 = (i & 0b1111111_0000000_0000000_0000000) >> 21
			const codePoint3 = (i & 0b1111111_0000000_0000000) >> 14
			const codePoint4 = (i & 0b1111111_0000000) >> 7
			const codePoint5 = i & 0b1111111
			return String.fromCodePoint(codePoint1, codePoint2, codePoint3, codePoint4, codePoint5)
		} else if (i < 2 ** 36) {
			const bI = BigInt(i)
			const codePoint1 = ((bI & 0b1_0000000_0000000_0000000_0000000_0000000n) >> 29n) | 0b100000n
			const codePoint2 = (bI & 0b1111111_0000000_0000000_0000000_0000000n) >> 28n
			const codePoint3 = (i & 0b1111111_0000000_0000000_0000000) >> 21
			const codePoint4 = (i & 0b1111111_0000000_0000000) >> 14
			const codePoint5 = (i & 0b1111111_0000000) >> 7
			const codePoint6 = i & 0b1111111
			return String.fromCodePoint(Number(codePoint1), Number(codePoint2), codePoint3, codePoint4, codePoint5, codePoint6)
		} else if (i < 2 ** 42) {
			const bI = BigInt(i)
			const codePoint2 = (bI & 0b1111111_0000000_0000000_0000000_0000000_0000000n) >> 35n
			const codePoint3 = (bI & 0b1111111_0000000_0000000_0000000_0000000n) >> 28n
			const codePoint4 = (i & 0b1111111_0000000_0000000_0000000) >> 21
			const codePoint5 = (i & 0b1111111_0000000_0000000) >> 14
			const codePoint6 = (i & 0b1111111_0000000) >> 7
			const codePoint7 = i & 0b1111111
			return String.fromCodePoint(0b1000000, Number(codePoint2), Number(codePoint3), codePoint4, codePoint5, codePoint6, codePoint7)
		} else if (i <= Number.MAX_SAFE_INTEGER) {
			const bI = BigInt(i)
			const codePoint2 = (bI & 0b1111111_0000000_0000000_0000000_0000000_0000000_0000000_0000000n) >> 49n
			const codePoint3 = (bI & 0b1111111_0000000_0000000_0000000_0000000_0000000_0000000n) >> 42n
			const codePoint4 = (bI & 0b1111111_0000000_0000000_0000000_0000000_0000000n) >> 35n
			const codePoint5 = (bI & 0b1111111_0000000_0000000_0000000_0000000n) >> 28n
			const codePoint6 = (i & 0b1111111_0000000_0000000_0000000) >> 21
			const codePoint7 = (i & 0b1111111_0000000_0000000) >> 14
			const codePoint8 = (i & 0b1111111_0000000) >> 7
			const codePoint9 = i & 0b1111111
			return String.fromCodePoint(0, Number(codePoint2), Number(codePoint3), Number(codePoint4), Number(codePoint5), codePoint6, codePoint7, codePoint8, codePoint9)
		} else { throw new Error("Not supported") }
	}
}

// ----------------------------------------------------------------------

export class InvalidVarInt56Error extends Error {
	constructor() {
		super("Invalid VarInt56")
	}
}

// ----------------------------------------------------------------------

export abstract class VarInt56Decoder {
	static decode(bytes: Uint8Array, offset: number = 0): [number, number] {
		if (offset >= bytes.length || offset < 0) { throw new Error(`Offset is out of range`) }
		const firstByte = bytes[offset]
		if ((firstByte & 0b10000000) === 0b10000000) { throw new InvalidVarInt56Error() }
		if ((firstByte & 0b00000001) === 0b00000001) {
			const value = (firstByte >> 1)
			return [value, 1]
		} else if ((firstByte & 0b00000010) === 0b00000010) {
			if (offset + 1 >= bytes.length) { throw new InvalidVarInt56Error() }
			const secondByte = bytes[offset+1]
			if ((secondByte & 0b10000000) === 0b10000000) { throw new InvalidVarInt56Error() }
			const value = (
				((firstByte & 0b1111100) << 5) |
				secondByte
			)
			return [value, 2]
		} else if ((firstByte & 0b00000100) === 0b00000100) {
			if (offset + 2 >= bytes.length) { throw new InvalidVarInt56Error() }
			const secondByte = bytes[offset+1]
			const thirdByte = bytes[offset+2]
			if ((secondByte & 0b10000000) === 0b10000000 ||
				(thirdByte & 0b10000000) === 0b10000000) {
				throw new InvalidVarInt56Error()
			}
			const value = (
				((firstByte & 0b1111000) << 11) |
				(secondByte << 7) |
				thirdByte
			)
			return [value, 3]
		} else if ((firstByte & 0b00001000) === 0b00001000) {
			if (offset + 3 >= bytes.length) { throw new InvalidVarInt56Error() }
			const secondByte = bytes[offset+1]
			const thirdByte = bytes[offset+2]
			const fourthByte = bytes[offset+3]
			if ((secondByte & 0b10000000) === 0b10000000 ||
				(thirdByte & 0b10000000) === 0b10000000 ||
				(fourthByte & 0b10000000) === 0b10000000) {
				throw new InvalidVarInt56Error()
			}
			const value = (
				((firstByte & 0b1110000) << 17) |
				(secondByte << 14) |
				(thirdByte << 7) |
				fourthByte
			)
			return [value, 4]
		} else if ((firstByte & 0b00010000) === 0b00010000) {
			if (offset + 4 >= bytes.length) { throw new InvalidVarInt56Error() }
			const secondByte = bytes[offset+1]
			const thirdByte = bytes[offset+2]
			const fourthByte = bytes[offset+3]
			const fifthByte = bytes[offset+4]
			if ((secondByte & 0b10000000) === 0b10000000 ||
				(thirdByte & 0b10000000) === 0b10000000 ||
				(fourthByte & 0b10000000) === 0b10000000 ||
				(fifthByte & 0b10000000) === 0b10000000) {
				throw new InvalidVarInt56Error()
			}
			const value = (
				((firstByte & 0b1100000) << 23) |
				(secondByte << 21) |
				(thirdByte << 14) |
				(fourthByte << 7) |
				fifthByte
			)
			return [value, 5]
		} else if ((firstByte & 0b00100000) === 0b00100000) {
			if (offset + 5 >= bytes.length) { throw new InvalidVarInt56Error() }
			const secondByte = bytes[offset+1]
			const thirdByte = bytes[offset+2]
			const fourthByte = bytes[offset+3]
			const fifthByte = bytes[offset+4]
			const sixthByte = bytes[offset+5]
			if ((secondByte & 0b10000000) === 0b10000000 ||
				(thirdByte & 0b10000000) === 0b10000000 ||
				(fourthByte & 0b10000000) === 0b10000000 ||
				(fifthByte & 0b10000000) === 0b10000000 ||
				(sixthByte & 0b10000000) === 0b10000000) {
				throw new InvalidVarInt56Error()
			}
			const value = (
				((BigInt(firstByte) & 0b1000000n) << 29n) |
				(BigInt(secondByte) << 28n) |
				(BigInt(thirdByte) << 21n) |
				(BigInt(fourthByte) << 14n) |
				(BigInt(fifthByte) << 7n) |
				BigInt(sixthByte)
			)
			return [Number(value), 6]
		} else if ((firstByte & 0b01000000) === 0b01000000) {
			if (offset + 6 >= bytes.length) { throw new InvalidVarInt56Error() }
			const secondByte = bytes[offset+1]
			const thirdByte = bytes[offset+2]
			const fourthByte = bytes[offset+3]
			const fifthByte = bytes[offset+4]
			const sixthByte = bytes[offset+5]
			const seventhByte = bytes[offset+6]
			if ((secondByte & 0b10000000) === 0b10000000 ||
				(thirdByte & 0b10000000) === 0b10000000 ||
				(fourthByte & 0b10000000) === 0b10000000 ||
				(fifthByte & 0b10000000) === 0b10000000 ||
				(sixthByte & 0b10000000) === 0b10000000 ||
				(seventhByte & 0b10000000) === 0b10000000) {
				throw new InvalidVarInt56Error()
			}
			const value = (
				(BigInt(secondByte) << 35n) |
				(BigInt(thirdByte) << 28n) |
				(BigInt(fourthByte) << 21n) |
				(BigInt(fifthByte) << 14n) |
				(BigInt(sixthByte) << 7n) |
				BigInt(seventhByte)
			)
			return [Number(value), 7]
		} else {
			if (offset + 8 >= bytes.length) { throw new InvalidVarInt56Error() }
			const secondByte = bytes[offset+1]
			const thirdByte = bytes[offset+2]
			const fourthByte = bytes[offset+3]
			const fifthByte = bytes[offset+4]
			const sixthByte = bytes[offset+5]
			const seventhByte = bytes[offset+6]
			const eigthByte = bytes[offset+7]
			const ninthByte = bytes[offset+8]
			if ((secondByte & 0b10000000) === 0b10000000 ||
				(thirdByte & 0b10000000) === 0b10000000 ||
				(fourthByte & 0b10000000) === 0b10000000 ||
				(fifthByte & 0b10000000) === 0b10000000 ||
				(sixthByte & 0b10000000) === 0b10000000 ||
				(seventhByte & 0b10000000) === 0b10000000 ||
				(eigthByte & 0b10000000) === 0b10000000 ||
				(ninthByte & 0b10000000) === 0b10000000) {
				throw new InvalidVarInt56Error()
			}
			const value = (
				(BigInt(secondByte) << 49n) |
				(BigInt(thirdByte) << 42n) |
				(BigInt(fourthByte) << 35n) |
				(BigInt(fifthByte) << 28n) |
				(BigInt(sixthByte) << 21n) |
				(BigInt(seventhByte) << 14n) |
				(BigInt(eigthByte) << 7n) |
				BigInt(ninthByte)
			)
			if (value > Number.MAX_SAFE_INTEGER) { throw new Error("Not supported") }
			return [Number(value), 9]
		}
	}

	static getLengthFromFirstByte(bytes: Uint8Array, offset: number = 0): number {
		if (offset >= bytes.length || offset < 0) { throw new Error(`Offset is out of range`) }
		const firstByte = bytes[offset]
		if ((firstByte & 0b10000000) === 0b10000000) { throw new InvalidVarInt56Error() }
		if ((firstByte & 0b00000001) === 0b00000001) { return 1 }
		else if ((firstByte & 0b00000010) === 0b00000010) { return 2 }
		else if ((firstByte & 0b00000100) === 0b00000100) { return 3 }
		else if ((firstByte & 0b00001000) === 0b00001000) { return 4 }
		else if ((firstByte & 0b00010000) === 0b00010000) { return 5 }
		else if ((firstByte & 0b00100000) === 0b00100000) { return 6 }
		else if ((firstByte & 0b01000000) === 0b01000000) { return 7 }
		else { return 9 }
	}
}

// ----------------------------------------------------------------------

export abstract class BinaryWsvUtil {
	static getPreambleVersion1(): Uint8Array {
		return new Uint8Array([0x42, 0x57, 0x53, 0x56, 0x31])
	}
}

// ----------------------------------------------------------------------

export class Uint8ArrayBuilder {
	private _buffer: Uint8Array
	private _numBytes: number = 0

	constructor(initialSize: number = 4096) {
		this._buffer = new Uint8Array(initialSize)
	}

	private prepare(appendLength: number) {
		if (this._numBytes + appendLength > this._buffer.length) {
			let newSize = this._buffer.length * 2
			while (this._numBytes + appendLength > newSize) {
				newSize *= 2
			}
			const newBuffer = new Uint8Array(newSize)
			newBuffer.set(this._buffer, 0)
			this._buffer = newBuffer
		}
	}

	push(part: Uint8Array) {
		this.prepare(part.length)
		this._buffer.set(part, this._numBytes)
		this._numBytes += part.length
	}

	pushByte(byte: number) {
		this.prepare(1)
		this._buffer[this._numBytes] = byte
		this._numBytes++
	}

	pushVarInt56(value: number) {
		this.prepare(9)
		this._numBytes += VarInt56Encoder.encodeIntoBuffer(value, this._buffer, this._numBytes)
	}

	getArray(): Uint8Array {
		return this._buffer.subarray(0, this._numBytes)
	}
}

// ----------------------------------------------------------------------

export abstract class BinaryWsvEncoder {
	private static readonly _lineBreakByte = 0b00000001
	private static readonly _nullValueByte = 0b00000011

	private static _encodeValues(values: (string | null)[], builder: Uint8ArrayBuilder) {
		for (const value of values) {
			if (value === null) {
				builder.pushByte(this._nullValueByte)
			} else {
				const valueEncoded = Utf16String.toUtf8Bytes(value)
				builder.pushVarInt56(valueEncoded.length + 2)
				builder.push(valueEncoded)
			}
		}
	}

	static encodeValues(values: (string | null)[]): Uint8Array {
		const builder: Uint8ArrayBuilder = new Uint8ArrayBuilder()
		this._encodeValues(values, builder)
		return builder.getArray()
	}

	static encodeJaggedArray(jaggedArray: (string | null)[][], withPreamble: boolean = true): Uint8Array {
		const preamble = BinaryWsvUtil.getPreambleVersion1()
		if (jaggedArray.length === 0 || 
			(jaggedArray.length === 1 && jaggedArray[0].length === 0)) {
			return withPreamble ? preamble : new Uint8Array()
		}
		const builder: Uint8ArrayBuilder = new Uint8ArrayBuilder()
		if (withPreamble === true) {
			builder.push(preamble)
		}
		let wasFirst = true
		for (const line of jaggedArray) {
			if (wasFirst === false) {
				builder.pushByte(this._lineBreakByte)
			}
			wasFirst = false
			this._encodeValues(line, builder)
		}

		return builder.getArray()
	}

	static encode(document: WsvDocument, withPreamble: boolean = true): Uint8Array {
		const preamble = BinaryWsvUtil.getPreambleVersion1()
		if (document.lines.length === 0 || 
			(document.lines.length === 1 && document.lines[0].values.length === 0)) {
			return withPreamble ? preamble : new Uint8Array()
		}
		const builder: Uint8ArrayBuilder = new Uint8ArrayBuilder()
		if (withPreamble === true) {
			builder.push(preamble)
		}
		let wasFirst = true
		for (const line of document.lines) {
			if (wasFirst === false) {
				builder.pushByte(this._lineBreakByte)
			}
			wasFirst = false
			this._encodeValues(line.values, builder)
		}

		return builder.getArray()
	}
}

// ----------------------------------------------------------------------

export class NoBinaryWsvPreambleError extends Error {
	constructor() {
		super("Document does not have a BinaryWSV preamble")
	}
}

// ----------------------------------------------------------------------

export class Uint8ArrayReader {
	buffer: Uint8Array
	offset: number

	constructor(buffer: Uint8Array, offset: number) {
		this.buffer = buffer
		this.offset = offset
	}

	get hasBytes(): boolean {
		return this.offset < this.buffer.length
	}

	readString(numBytes: number): string {
		if (this.offset+numBytes > this.buffer.length) { throw new Error(`Can not fully read string`) }
		const valueBytes = this.buffer.subarray(this.offset, this.offset+numBytes)
		this.offset += numBytes
		return Utf16String.fromUtf8Bytes(valueBytes)
	}

	readVarInt56(): number {
		if (this.offset >= this.buffer.length || this.offset < 0) { throw new Error(`Offset is out of range`) }
		const firstByte = this.buffer[this.offset]
		if ((firstByte & 0b10000000) === 0b10000000) { throw new InvalidVarInt56Error() }
		if ((firstByte & 0b00000001) === 0b00000001) {
			const value = (firstByte >> 1)
			this.offset += 1
			return value
		} else if ((firstByte & 0b00000010) === 0b00000010) {
			if (this.offset + 1 >= this.buffer.length) { throw new InvalidVarInt56Error() }
			const secondByte = this.buffer[this.offset+1]
			if ((secondByte & 0b10000000) === 0b10000000) { throw new InvalidVarInt56Error() }
			const value = (
				((firstByte & 0b1111100) << 5) |
				secondByte
			)
			this.offset += 2
			return value
		} else if ((firstByte & 0b00000100) === 0b00000100) {
			if (this.offset + 2 >= this.buffer.length) { throw new InvalidVarInt56Error() }
			const secondByte = this.buffer[this.offset+1]
			const thirdByte = this.buffer[this.offset+2]
			if ((secondByte & 0b10000000) === 0b10000000 ||
				(thirdByte & 0b10000000) === 0b10000000) {
				throw new InvalidVarInt56Error()
			}
			const value = (
				((firstByte & 0b1111000) << 11) |
				(secondByte << 7) |
				thirdByte
			)
			this.offset += 3
			return value
		} else if ((firstByte & 0b00001000) === 0b00001000) {
			if (this.offset + 3 >= this.buffer.length) { throw new InvalidVarInt56Error() }
			const secondByte = this.buffer[this.offset+1]
			const thirdByte = this.buffer[this.offset+2]
			const fourthByte = this.buffer[this.offset+3]
			if ((secondByte & 0b10000000) === 0b10000000 ||
				(thirdByte & 0b10000000) === 0b10000000 ||
				(fourthByte & 0b10000000) === 0b10000000) {
				throw new InvalidVarInt56Error()
			}
			const value = (
				((firstByte & 0b1110000) << 17) |
				(secondByte << 14) |
				(thirdByte << 7) |
				fourthByte
			)
			this.offset += 4
			return value
		} else if ((firstByte & 0b00010000) === 0b00010000) {
			if (this.offset + 4 >= this.buffer.length) { throw new InvalidVarInt56Error() }
			const secondByte = this.buffer[this.offset+1]
			const thirdByte = this.buffer[this.offset+2]
			const fourthByte = this.buffer[this.offset+3]
			const fifthByte = this.buffer[this.offset+4]
			if ((secondByte & 0b10000000) === 0b10000000 ||
				(thirdByte & 0b10000000) === 0b10000000 ||
				(fourthByte & 0b10000000) === 0b10000000 ||
				(fifthByte & 0b10000000) === 0b10000000) {
				throw new InvalidVarInt56Error()
			}
			const value = (
				((firstByte & 0b1100000) << 23) |
				(secondByte << 21) |
				(thirdByte << 14) |
				(fourthByte << 7) |
				fifthByte
			)
			this.offset += 5
			return value
		} else if ((firstByte & 0b00100000) === 0b00100000) {
			if (this.offset + 5 >= this.buffer.length) { throw new InvalidVarInt56Error() }
			const secondByte = this.buffer[this.offset+1]
			const thirdByte = this.buffer[this.offset+2]
			const fourthByte = this.buffer[this.offset+3]
			const fifthByte = this.buffer[this.offset+4]
			const sixthByte = this.buffer[this.offset+5]
			if ((secondByte & 0b10000000) === 0b10000000 ||
				(thirdByte & 0b10000000) === 0b10000000 ||
				(fourthByte & 0b10000000) === 0b10000000 ||
				(fifthByte & 0b10000000) === 0b10000000 ||
				(sixthByte & 0b10000000) === 0b10000000) {
				throw new InvalidVarInt56Error()
			}
			const value = (
				((BigInt(firstByte) & 0b1000000n) << 29n) |
				(BigInt(secondByte) << 28n) |
				(BigInt(thirdByte) << 21n) |
				(BigInt(fourthByte) << 14n) |
				(BigInt(fifthByte) << 7n) |
				BigInt(sixthByte)
			)
			this.offset += 6
			return Number(value)
		} else if ((firstByte & 0b01000000) === 0b01000000) {
			if (this.offset + 6 >= this.buffer.length) { throw new InvalidVarInt56Error() }
			const secondByte = this.buffer[this.offset+1]
			const thirdByte = this.buffer[this.offset+2]
			const fourthByte = this.buffer[this.offset+3]
			const fifthByte = this.buffer[this.offset+4]
			const sixthByte = this.buffer[this.offset+5]
			const seventhByte = this.buffer[this.offset+6]
			if ((secondByte & 0b10000000) === 0b10000000 ||
				(thirdByte & 0b10000000) === 0b10000000 ||
				(fourthByte & 0b10000000) === 0b10000000 ||
				(fifthByte & 0b10000000) === 0b10000000 ||
				(sixthByte & 0b10000000) === 0b10000000 ||
				(seventhByte & 0b10000000) === 0b10000000) {
				throw new InvalidVarInt56Error()
			}
			const value = (
				(BigInt(secondByte) << 35n) |
				(BigInt(thirdByte) << 28n) |
				(BigInt(fourthByte) << 21n) |
				(BigInt(fifthByte) << 14n) |
				(BigInt(sixthByte) << 7n) |
				BigInt(seventhByte)
			)
			this.offset += 7
			return Number(value)
		} else {
			if (this.offset + 8 >= this.buffer.length) { throw new InvalidVarInt56Error() }
			const secondByte = this.buffer[this.offset+1]
			const thirdByte = this.buffer[this.offset+2]
			const fourthByte = this.buffer[this.offset+3]
			const fifthByte = this.buffer[this.offset+4]
			const sixthByte = this.buffer[this.offset+5]
			const seventhByte = this.buffer[this.offset+6]
			const eigthByte = this.buffer[this.offset+7]
			const ninthByte = this.buffer[this.offset+8]
			if ((secondByte & 0b10000000) === 0b10000000 ||
				(thirdByte & 0b10000000) === 0b10000000 ||
				(fourthByte & 0b10000000) === 0b10000000 ||
				(fifthByte & 0b10000000) === 0b10000000 ||
				(sixthByte & 0b10000000) === 0b10000000 ||
				(seventhByte & 0b10000000) === 0b10000000 ||
				(eigthByte & 0b10000000) === 0b10000000 ||
				(ninthByte & 0b10000000) === 0b10000000) {
				throw new InvalidVarInt56Error()
			}
			const value = (
				(BigInt(secondByte) << 49n) |
				(BigInt(thirdByte) << 42n) |
				(BigInt(fourthByte) << 35n) |
				(BigInt(fifthByte) << 28n) |
				(BigInt(sixthByte) << 21n) |
				(BigInt(seventhByte) << 14n) |
				(BigInt(eigthByte) << 7n) |
				BigInt(ninthByte)
			)
			if (value > Number.MAX_SAFE_INTEGER) { throw new Error("Not supported") }
			this.offset += 9
			return Number(value)
		}
	}
}

// ----------------------------------------------------------------------

export abstract class BinaryWsvDecoder {
	static getVersion(bytes: Uint8Array): string {
		const version = this.getVersionOrNull(bytes)
		if (version === null) {
			throw new NoBinaryWsvPreambleError()
		}
		return version
	}

	static getVersionOrNull(bytes: Uint8Array): string | null {
		if (bytes.length < 5 ||
			bytes[0] !== 0x42 ||
			bytes[1] !== 0x57 ||
			bytes[2] !== 0x53 ||
			bytes[3] !== 0x56) {
			return null
		}
		return String.fromCharCode(bytes[4])
	}

	static decodeValue(reader: Uint8ArrayReader, values: (string | null)[]): boolean {
		const varInt = reader.readVarInt56()
		if (varInt === 0) {
			return true
		} else if (varInt === 1) {
			values.push(null)
		} else if (varInt === 2) {
			values.push("")
		} else {
			const valueLength = varInt - 2
			const strValue = reader.readString(valueLength)
			values.push(strValue)
		}
		return false
	}

	static decodeAsJaggedArray(bytes: Uint8Array, withPreamble: boolean = true): (string | null)[][] {
		if (withPreamble === true) {	
			const version = this.getVersion(bytes)
			if (version !== "1") {
				throw new Error(`Not supported BinaryWSV version '${version}'`)
			}
		}
		const result: (string | null)[][] = []
		const reader = new Uint8ArrayReader(bytes, withPreamble ? 5 : 0)
		let currentLine: (string | null)[] = []
		while (reader.hasBytes) {
			const wasLineBreak = this.decodeValue(reader, currentLine)
			if (wasLineBreak) {
				result.push(currentLine)
				currentLine = []
			}
		}
		result.push(currentLine)
		return result
	}

	static decode(bytes: Uint8Array, withPreamble: boolean = true): WsvDocument {
		if (withPreamble === true) {	
			const version = this.getVersion(bytes)
			if (version !== "1") {
				throw new Error(`Not supported BinaryWSV version '${version}'`)
			}
		}
		const document: WsvDocument = new WsvDocument()
		const reader = new Uint8ArrayReader(bytes, withPreamble ? 5 : 0)
		let currentLine: (string | null)[] = []
		while (reader.hasBytes) {
			const wasLineBreak = this.decodeValue(reader, currentLine)
			if (wasLineBreak) {
				document.addLine(currentLine)
				currentLine = []
			}
		}
		document.addLine(currentLine)
		return document
	}
}