import {Element, parseXml} from 'libxmljs2';
import {readFileAsync} from './Promisified.js';

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
    const altoXml = await readFileAsync(uri, 'utf8');
    const alto = parseXml(altoXml);

    let i = 0;
    const ns = {'alto': alto.root()?.namespaces().find(ns => ns.prefix() == null)?.href() || ''};

    return {
        blocks: alto.find<Element>('//alto:TextBlock | //TextBlock', ns).map(blockElem => ({
            lines: blockElem.find<Element>('./alto:TextLine | ./TextLine', ns).map(lineElem => ({
                words: lineElem.find<Element>('./alto:String | ./String', ns).reduce((acc, stringElem) => {
                    const content = stringElem.attr('CONTENT')?.value();
                    if (content) {
                        const x = stringElem.attr('HPOS')?.value();
                        const y = stringElem.attr('VPOS')?.value();
                        const width = stringElem.attr('WIDTH')?.value();
                        const height = stringElem.attr('HEIGHT')?.value();

                        acc.push({
                            idx: i++,
                            x: (x && parseInt(x)) || undefined,
                            y: (y && parseInt(y)) || undefined,
                            width: (width && parseInt(width)) || undefined,
                            height: (height && parseInt(height)) || undefined,
                            isHyphenated: stringElem.attr('SUBS_TYPE')?.value() === 'HypPart1',
                            content
                        });
                    }
                    return acc;
                }, [] as TextWord[])
            })).filter(line => line.words.length > 0)
        })).filter(block => block.lines.length > 0)
    };
}
