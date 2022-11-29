const pageRegex = /(\d{1,3})(_bis_)?([rv]?)_?([a-z]?)/;
const parseRegex = /(\d{1,3})(_bis_)?([rv]?)_?([a-z]?)(-(\d{1,3})(_bis_)?([rv]?)_?([a-z]?))?/;
const matchesCode = (label: string, code: string) => label.match(new RegExp(`(^|_)${code}($|_)`, 'i')) !== null;

export interface FileInfo {
    type?: Type;
    pages: Page[];
    isNote: boolean;
    isBonus: boolean;
    isFolium: boolean;
    isFrontEndPaper: boolean;
    isBackEndPaper: boolean;
    hasRuler: boolean;
    hasColorChecker: boolean;
}

export interface Type {
    code: string;
    name: string;
    order: number;
    beforePages: boolean;
}

export interface Page {
    folioPageNumber?: number;
    subFolioPage?: string;
    isRecto: boolean;
    isVerso: boolean;
}

export const allTypes: { [code: string]: Type } = {
    'FrontCover': {code: 'FrontCover', name: 'Front cover', order: 1, beforePages: true},
    'FrontBoard': {code: 'FrontBoard', name: 'Front board', order: 2, beforePages: true},
    'LowerBoard': {code: 'LowerBoard', name: 'Lower board', order: 3, beforePages: false},
    'BackCover': {code: 'BackCover', name: 'Back cover', order: 4, beforePages: false},
    'Back': {code: 'Back', name: 'Back', order: 5, beforePages: false},
    'Top_Edge': {code: 'Top_Edge', name: 'Top edge', order: 6, beforePages: false},
    'Front_Edge': {code: 'Front_Edge', name: 'Front edge', order: 7, beforePages: false},
    'Bottom_Edge': {code: 'Bottom_Edge', name: 'Bottom edge', order: 8, beforePages: false},
    'OpenView': {code: 'OpenView', name: 'Open view', order: 9, beforePages: false},
};

export function parsePage(page: string): Page | null {
    const regexResult = page.match(pageRegex);
    if (regexResult) {
        return {
            folioPageNumber: parseInt(regexResult[1]),
            subFolioPage: regexResult[4].length > 0 ? regexResult[4] : (regexResult[2] ? 'bis' : undefined),
            isRecto: regexResult[3] === 'r',
            isVerso: regexResult[3] === 'v'
        };
    }

    return null;
}

export function parseLabel(label: string): FileInfo {
    const typeCode = Object.keys(allTypes).find(code => matchesCode(label, code));
    const type = typeCode ? allTypes[typeCode] : undefined;

    const isNote = matchesCode(label, 'Note');
    const isBonus = matchesCode(label, 'Bonus');
    const isFolium = matchesCode(label, 'Folium');
    const isFrontEndPaper = matchesCode(label, 'FrontEndpaper');
    const isBackEndPaper = matchesCode(label, 'BackEndpaper');
    const hasRuler = matchesCode(label, 'Ruler');
    const hasColorChecker = matchesCode(label, 'ICC');

    const pages: Page[] = [];
    const regexResult = label.match(parseRegex);
    if (regexResult) {
        pages.push({
            folioPageNumber: parseInt(regexResult[1]),
            subFolioPage: regexResult[4].length > 0 ? regexResult[4] : (regexResult[2] ? 'bis' : undefined),
            isRecto: regexResult[3] === 'r',
            isVerso: regexResult[3] === 'v'
        });

        if (regexResult[5] !== undefined) {
            pages.push({
                folioPageNumber: parseInt(regexResult[6]),
                subFolioPage: regexResult[9].length > 0 ? regexResult[9] : (regexResult[7] ? 'bis' : undefined),
                isRecto: regexResult[8] === 'r',
                isVerso: regexResult[8] === 'v'
            });
        }
    }

    return {
        type,
        pages,
        isNote,
        isBonus,
        isFolium,
        isFrontEndPaper,
        isBackEndPaper,
        hasRuler,
        hasColorChecker
    };
}

export function equalsPages(pageA: Page, pageB: Page): boolean {
    return pageA.folioPageNumber === pageB.folioPageNumber &&
        pageA.subFolioPage === pageB.subFolioPage &&
        pageA.isRecto === pageB.isRecto &&
        pageA.isVerso === pageB.isVerso;
}
