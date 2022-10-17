import {CanvasIIIFMetadata, ItemParams} from '../../lib/ServiceTypes.js';
import {FileInfo, parseLabel} from './util/fileinfo.js'

export default async function getCanvasIIIFMetadata({item}: ItemParams): Promise<CanvasIIIFMetadata> {
    const fileInfo: FileInfo = parseLabel(item.label);

    return {
        label: getLabel(fileInfo),
        // behavior: fileInfo.type || (!fileInfo.pages && (fileInfo.hasRuler || fileInfo.hasColorChecker))
        //     ? 'non-paged' : undefined
    };
}

function getLabel(fileInfo: FileInfo): string {
    const pageLabels = [];
    for (const page of fileInfo.pages)
        pageLabels.push(`${page.folioPageNumber || ''}${page.subFolio || ''}${page.isRecto ? 'r' : ''}${page.isVerso ? 'v' : ''}`);

    const labels = [];
    if (fileInfo.type)
        labels.push(fileInfo.type.name);

    if (fileInfo.isFrontEndPaper)
        labels.push('Frontend paper');

    if (fileInfo.isBackEndPaper)
        labels.push('Backend paper');

    if (pageLabels.length > 0)
        labels.push(pageLabels.join('-'));

    const isAdditional = labels.length === 0;
    if (isAdditional) {
        if (fileInfo.isNote)
            labels.push('Note');
        else if (fileInfo.hasRuler)
            labels.push('Ruler');
        else if (fileInfo.hasColorChecker)
            labels.push('ColorChecker');
    }

    const extraLabels = [];
    if (fileInfo.isBonus)
        extraLabels.push('additional');

    if (!isAdditional && fileInfo.isNote)
        extraLabels.push('note');

    if (!isAdditional || fileInfo.isNote) {
        if (fileInfo.hasRuler && fileInfo.hasColorChecker)
            extraLabels.push('with ColorChecker and ruler');
        else if (!isAdditional && fileInfo.hasRuler)
            extraLabels.push('with ruler');
        else if (!isAdditional && fileInfo.hasColorChecker)
            extraLabels.push('with ColorChecker');
    }

    if (extraLabels.length > 0)
        labels.push(`(${extraLabels.join('; ')})`);

    return labels.join(' ');
}
