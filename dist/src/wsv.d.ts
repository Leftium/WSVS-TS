import { ReliableTxtEncoding } from "@stenway/reliabletxt";
export declare class WsvParserError extends Error {
    readonly index: number;
    readonly lineIndex: number;
    readonly linePosition: number;
    constructor(index: number, lineIndex: number, linePosition: number, message: string);
}
export declare abstract class WsvStringUtil {
    static validateWhitespaceStrings(values: (string | null)[] | null): void;
    static validateWhitespaceString(str: string, isFirst: boolean): void;
    static validateComment(value: string | null): void;
}
export declare class WsvLine {
    values: (string | null)[];
    private _whitespaces;
    private _comment;
    get hasValues(): boolean;
    get whitespaces(): (string | null)[] | null;
    set whitespaces(values: (string | null)[] | null);
    get comment(): string | null;
    set comment(value: string | null);
    get hasComment(): boolean;
    constructor(values: (string | null)[], whitespaces?: (string | null)[] | null, comment?: string | null);
    set(values: (string | null)[], whitespaces?: (string | null)[] | null, comment?: string | null): void;
    toString(preserveWhitespaceAndComment?: boolean): string;
    static internal(values: (string | null)[], whitespaces: (string | null)[] | null, comment: string | null): WsvLine;
    static internalWhitespaces(line: WsvLine): (string | null)[] | null;
    static parse(str: string, preserveWhitespacesAndComments?: boolean): WsvLine;
    static parseAsArray(str: string): (string | null)[];
    static serialize(values: (string | null)[]): string;
}
export declare class WsvDocument {
    lines: WsvLine[];
    encoding: ReliableTxtEncoding;
    constructor(lines?: WsvLine[], encoding?: ReliableTxtEncoding);
    addLine(values: (string | null)[], whitespaces?: (string | null)[] | null, comment?: string | null): void;
    toJaggedArray(): (string | null)[][];
    toString(preserveWhitespaceAndComment?: boolean): string;
    getBytes(preserveWhitespacesAndComments?: boolean): Uint8Array;
    toBase64String(preserveWhitespacesAndComments?: boolean): string;
    toBinaryWsv(): Uint8Array;
    static parse(str: string, preserveWhitespacesAndComments?: boolean, encoding?: ReliableTxtEncoding): WsvDocument;
    static parseAsJaggedArray(str: string): (string | null)[][];
    static fromJaggedArray(jaggedArray: (string | null)[][], encoding?: ReliableTxtEncoding): WsvDocument;
    static fromBytes(bytes: Uint8Array, preserveWhitespacesAndComments?: boolean): WsvDocument;
    static fromLines(lines: string[], preserveWhitespacesAndComments?: boolean, encoding?: ReliableTxtEncoding): WsvDocument;
    static fromBase64String(base64Str: string): WsvDocument;
    static fromBinaryWsv(bytes: Uint8Array): WsvDocument;
}
export declare abstract class WsvValue {
    private static containsSpecialChar;
    static isSpecial(value: string | null): boolean;
    static serialize(value: string | null): string;
    static parse(str: string, allowWhitespaceAndComment?: boolean): string | null;
}
export declare abstract class WsvSerializer {
    static serializeValues(values: (string | null)[]): string;
    static serializeJaggedArray(jaggedArray: (string | null)[][]): string;
    static internalSerializeValuesWhitespacesAndComment(values: (string | null)[], whitespaces: (string | null)[] | null, comment: string | null): string;
    static serializeLines(lines: WsvLine[], preserveWhitespaceAndComment?: boolean): string;
}
export declare abstract class WsvParser {
    private static readonly stringNotClosed;
    private static readonly invalidStringLineBreak;
    private static readonly invalidCharacterAfterString;
    private static readonly invalidDoubleQuoteInValue;
    static parseLine(str: string, preserveWhitespacesAndComments: boolean, lineIndexOffset?: number): WsvLine;
    static parseLines(str: string, preserveWhitespacesAndComments: boolean, lineIndexOffset?: number): WsvLine[];
    private static getError;
    private static parseLinesPreserving;
    private static parseLinesNonPreserving;
    static parseAsJaggedArray(str: string, lineIndexOffset?: number): (string | null)[][];
}
export declare abstract class VarInt56Encoder {
    static encode(i: number): Uint8Array;
    static encodeIntoBuffer(i: number, buffer: Uint8Array, offset: number): number;
    static encodeAsString(i: number): string;
}
export declare class InvalidVarInt56Error extends Error {
    constructor();
}
export declare abstract class VarInt56Decoder {
    static decode(bytes: Uint8Array, offset?: number): [number, number];
    static getLengthFromFirstByte(bytes: Uint8Array, offset?: number): number;
}
export declare abstract class BinaryWsvUtil {
    static getPreambleVersion1(): Uint8Array;
}
export declare class Uint8ArrayBuilder {
    private _buffer;
    private _numBytes;
    constructor(initialSize?: number);
    private prepare;
    push(part: Uint8Array): void;
    pushByte(byte: number): void;
    pushVarInt56(value: number): void;
    getArray(): Uint8Array;
}
export declare abstract class BinaryWsvEncoder {
    private static readonly _lineBreakByte;
    private static readonly _nullValueByte;
    private static _encodeValues;
    static encodeValues(values: (string | null)[]): Uint8Array;
    static encodeJaggedArray(jaggedArray: (string | null)[][], withPreamble?: boolean): Uint8Array;
    static encode(document: WsvDocument, withPreamble?: boolean): Uint8Array;
}
export declare class NoBinaryWsvPreambleError extends Error {
    constructor();
}
export declare class Uint8ArrayReader {
    buffer: Uint8Array;
    offset: number;
    constructor(buffer: Uint8Array, offset: number);
    get hasBytes(): boolean;
    readString(numBytes: number): string;
    readVarInt56(): number;
}
export declare abstract class BinaryWsvDecoder {
    static getVersion(bytes: Uint8Array): string;
    static getVersionOrNull(bytes: Uint8Array): string | null;
    static decodeValue(reader: Uint8ArrayReader, values: (string | null)[]): boolean;
    static decodeAsJaggedArray(bytes: Uint8Array, withPreamble?: boolean): (string | null)[][];
    static decode(bytes: Uint8Array, withPreamble?: boolean): WsvDocument;
}
//# sourceMappingURL=wsv.d.ts.map