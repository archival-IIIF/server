import {XmlDocument} from 'libxml2-wasm';
import {readFile} from 'node:fs/promises';

const VTT_IGNORE_REGEX = /^(STYLE|REGION|NOTE)/;
const VTT_TIMECODE_REGEX = /^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/;

export type TextGranularity = 'page' | 'block' | 'paragraph' | 'line' | 'word' | 'glyph';

export interface TextStructure {
    granularity: TextGranularity;
    content: (TextStructure | TextBlock)[];
}

export interface TextBlock {
    granularity: TextGranularity;
    idx: number;
    content: string;
}

export interface ImageTextBlock extends TextBlock {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    isHyphenated: boolean;
}

export interface AudioTextBlock extends TextBlock {
    start?: number;
    end?: number;
}

export function getBlocksFromStructure(textStructure: TextStructure): TextBlock[] {
    return textStructure.content.flatMap(block =>
        'idx' in block ? block : getBlocksFromStructure(block));
}

export function getTextFromStructure(textStructure: TextStructure): string {
    return textStructure.content.reduce((acc, block) => {
        let newText = acc;

        if ('idx' in block)
            newText += block.content + ('isHyphenated' in block && block.isHyphenated ? '' : ' ');
        else
            newText += getTextFromStructure(block);

        if (block.granularity === 'line')
            newText += '\n';
        else if (block.granularity === 'block' || block.granularity === 'paragraph')
            newText += '\n\n';

        return newText;
    }, '');
}

export async function readAlto(uri: string): Promise<TextStructure> {
    using alto = XmlDocument.fromBuffer(await readFile(uri));

    let i = 0;
    const ns = {'alto': Object.values(alto.root.namespaces).find(uri => uri) || ''};

    return {
        granularity: 'page',
        content: alto.find('//alto:TextBlock | //TextBlock', ns).map<TextStructure>(blockElem => ({
            granularity: 'block',
            content: blockElem.find('./alto:TextLine | ./TextLine', ns).map<TextStructure | TextBlock>(lineElem => {
                const lineStructure: TextStructure = {
                    granularity: 'line',
                    content: lineElem.find('./alto:String | ./String', ns).reduce((acc, stringElem) => {
                        const content = stringElem.get('@CONTENT')?.content;
                        if (content) {
                            const x = stringElem.get('@HPOS')?.content;
                            const y = stringElem.get('@VPOS')?.content;
                            const width = stringElem.get('@WIDTH')?.content;
                            const height = stringElem.get('@HEIGHT')?.content;

                            acc.push({
                                granularity: 'word',
                                idx: i++,
                                x: (x && parseInt(x)) || undefined,
                                y: (y && parseInt(y)) || undefined,
                                width: (width && parseInt(width)) || undefined,
                                height: (height && parseInt(height)) || undefined,
                                isHyphenated: stringElem.get('@SUBS_TYPE')?.content === 'HypPart1',
                                content
                            });
                        }
                        return acc;
                    }, [] as ImageTextBlock[])
                };

                if (lineStructure.content.length === 1 && (lineStructure.content[0] as TextBlock).content.includes(' '))
                    return {...lineStructure.content[0], granularity: 'line'};

                return lineStructure;
            }).filter(line => line.content.length > 0)
        })).filter(block => block.content.length > 0)
    };
}

export async function readVtt(uri: string): Promise<TextStructure> {
    const createBlock = (idx: number, start: number, end: number, content: string): AudioTextBlock => ({
        granularity: 'block', idx, start, end, content
    });

    const vttContent = await readFile(uri, 'utf-8');
    const lines = vttContent.split(/\r?\n/);

    const blocks: TextBlock[] = [];
    let i = 0;
    let cue: { start?: number, end?: number, payload?: string } = {};
    let isCuePayload = false;
    let inIgnoredBlock = false;

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
            if (cue.start && cue.end && cue.payload)
                blocks.push(createBlock(i++, cue.start, cue.end, cue.payload));
            cue = {};
            isCuePayload = false;
            inIgnoredBlock = false;
        }
        else if (VTT_IGNORE_REGEX.test(trimmedLine))
            inIgnoredBlock = true;
        else if (inIgnoredBlock)
            continue;
        else if (VTT_TIMECODE_REGEX.test(line)) {
            const [start, end] = line.split(' --> ').map(time => {
                const [hours, minutes, seconds] = time.split(' ')[0].trim().split(':').map(parseFloat);
                return hours * 3600 + minutes * 60 + seconds;
            });

            cue = {start, end, payload: ''};
            isCuePayload = true;
        }
        else if (isCuePayload)
            cue.payload += (cue.payload ? '\n' : '') + line.trim();
    }

    if (cue.start && cue.end && cue.payload)
        blocks.push(createBlock(i++, cue.start, cue.end, cue.payload));

    return {
        granularity: 'page',
        content: blocks
    };
}
