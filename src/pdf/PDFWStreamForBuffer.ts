export default class PDFWStreamForBuffer {
    buffer: Buffer | null = null;
    position = 0;

    write(inBytesArray: Uint8Array): number {
        if (inBytesArray.length > 0) {
            if (!this.buffer)
                this.buffer = Buffer.from(inBytesArray);
            else
                this.buffer = Buffer.concat([this.buffer, Buffer.from(inBytesArray)]);

            this.position += inBytesArray.length;
            return inBytesArray.length;
        }

        return 0;
    };

    getCurrentPosition(): number {
        return this.position;
    };
}