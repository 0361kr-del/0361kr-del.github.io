interface QRCode { addData(value: string): void; make(): void; getModuleCount(): number; isDark(row: number, col: number): boolean; }
declare function qrcode(type: number, level: 'L'|'M'|'Q'|'H'): QRCode;
export default qrcode;
