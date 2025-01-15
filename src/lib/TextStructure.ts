import {XmlDocument} from 'libxml2-wasm';
import {readFile} from 'node:fs/promises';

export interface TextStructure {
    blocks: TextBlock[];
}

export interface TextBlock {
    lines: TextLine[];
}

export interface TextLine {
    words: TextWord[];
}

export interface TextWord {
    idx: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    isHyphenated: boolean;
    content: string;
}

export function getWordsFromStructure(textStructure: TextStructure): TextWord[] {
    return textStructure.blocks.flatMap(block => block.lines.flatMap(line => line.words));
}

export function getTextFromStructure(textStructure: TextStructure): string {
    return textStructure.blocks.map(block =>
        block.lines
            .flatMap(line => line.words)
            .reduce((acc, word) => acc + word.content + (word.isHyphenated ? '' : ' '), '')
            .trim()
    ).join('\n');
}

export async function readAlto(uri: string): Promise<TextStructure> {
    using alto = XmlDocument.fromBuffer(await readFile(uri));

    let i = 0;
    const ns = {'alto': Object.values(alto.root.namespaces).find(uri => uri) || ''};

    return {
        blocks: alto.find('//alto:TextBlock | //TextBlock', ns).map(blockElem => ({
            lines: blockElem.find('./alto:TextLine | ./TextLine', ns).map(lineElem => ({
                words: lineElem.find('./alto:String | ./String', ns).reduce((acc, stringElem) => {
                    const content = stringElem.get('@CONTENT')?.content;
                    if (content) {
                        const x = stringElem.get('@HPOS')?.content;
                        const y = stringElem.get('@VPOS')?.content;
                        const width = stringElem.get('@WIDTH')?.content;
                        const height = stringElem.get('@HEIGHT')?.content;

                        acc.push({
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
                }, [] as TextWord[])
            })).filter(line => line.words.length > 0)
        })).filter(block => block.lines.length > 0)
    };
}
