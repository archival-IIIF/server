const pdfTypes = [
    'fmt/446',
    'fmt/447',
    'fmt/448',
    'fmt/449',
    'fmt/452',
    'fmt/867',
    'fmt/14',
    'fmt/15',
    'fmt/16',
    'fmt/17',
    'fmt/18',
    'fmt/19',
    'fmt/20',
    'fmt/276',
    'fmt/493',
    'fmt/95',
    'fmt/354',
    'fmt/476',
    'fmt/477',
    'fmt/478',
    'fmt/479',
    'fmt/480',
    'fmt/481',
    'fmt/144',
    'fmt/145',
    'fmt/157',
    'fmt/146',
    'fmt/147',
    'fmt/158',
    'fmt/148',
    'fmt/488',
    'fmt/489',
    'fmt/490',
    'fmt/492',
    'fmt/491'
];
const imageTypes = [
    'fmt/3',
    'fmt/4',
    'x-fmt/92',
    'fmt/117',
    'fmt/436',
    'fmt/152',
    'fmt/437',
    'fmt/438',
    'fmt/367',
    'x-fmt/398',
    'x-fmt/390',
    'x-fmt/391',
    'x-fmt/399',
    'x-fmt/388',
    'fmt/116',
    'fmt/118',
    'x-fmt/270',
    'fmt/114',
    'fmt/13',
    'fmt/42',
    'fmt/43',
    'fmt/44',
    'fmt/41',
    'fmt/112',
    'x-fmt/392',
    'fmt/12',
    'fmt/11',
    'fmt/155',
    'fmt/156',
    'fmt/153',
    'fmt/154',
    'fmt/353',
    'fmt/192',
    'fmt/202',
    'x-fmt/185',
    'fmt/402',
    'x-fmt/367',
    'fmt/341',
    'x-fmt/80',
    'x-fmt/387',
    'fmt/191',
    'fmt/115',
    'fmt/119',
    'fmt/662',
    'fmt/668',
    'fmt/1001',
    'fmt/645'
];
const audioTypes = [
    'x-fmt/136',
    'fmt/414',
    'fmt/1',
    'fmt/2',
    'fmt/527',
    'x-fmt/397',
    'x-fmt/389',
    'x-fmt/396',
    'fmt/347',
    'fmt/198',
    'fmt/6',
    'fmt/141',
    'fmt/142',
    'fmt/132',
    'fmt/134',
    'fmt/703',
    'fmt/704',
    'fmt/705',
    'fmt/706',
    'fmt/707',
    'fmt/708',
    'fmt/709',
    'fmt/710',
    'fmt/711',
    'fmt/712',
    'fmt/713'
];
const videoTypes = [
    'fmt/569',
    'fmt/507',
    'fmt/505',
    'fmt/506',
    'fmt/131',
    'fmt/5',
    'x-fmt/384',
    'fmt/200',
    'fmt/104',
    'fmt/105',
    'fmt/106',
    'fmt/107',
    'fmt/108',
    'fmt/109',
    'fmt/110',
    'x-fmt/382',
    'fmt/133',
    'fmt/441',
    'fmt/199'
];

export const pronomByExtension: {[extension: string]: string} = {
    '.jpg': 'fmt/43',
    '.mp3': 'fmt/134',
    '.tif': 'fmt/353',
    '.mp4': 'fmt/199',
    '.pdf': 'fmt/95',
};

export function getTypeForPronom(puid: string | null): string {
    if (puid && pdfTypes.includes(puid))
        return 'pdf';

    if (puid && imageTypes.includes(puid))
        return 'image';

    if (puid && audioTypes.includes(puid))
        return 'audio';

    if (puid && videoTypes.includes(puid))
        return 'video';

    return 'file';
}
