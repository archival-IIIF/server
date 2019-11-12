import * as hummus from 'hummus';
import {join} from 'path';

import {ImageItem} from '../lib/ItemInterfaces';
import {Text, readAlto, getFullPath} from '../lib/Text';

import {getImage} from '../image/imageServer';
import {AccessTier} from '../presentation/elem/v2/Image';

export default async function createPDF(items: ImageItem[], texts: Text[], tier?: AccessTier): Promise<Buffer> {
    const bufferWriter = new hummus.PDFWStreamForBuffer();
    const pdf = hummus.createWriter(bufferWriter);
    const font = (texts.length > 0) ? pdf.getFontForFile(join(__dirname, 'NotoMono-Regular.ttf')) : null;

    for (const item of items) {
        const textOfPage = texts.find(text => text.item_id === item.id);
        await createPdfPage(pdf, font, item, textOfPage, tier);
    }

    pdf.end();

    return bufferWriter.buffer;
}

async function createPdfPage(pdf: hummus.PDFWriter, font: hummus.UsedFont | null, item: ImageItem,
                             text?: Text, tier?: AccessTier) {
    const image = await getImage(item, {
        region: 'full',
        size: 'max',
        rotation: '0',
        quality: 'default',
        format: 'jpg'
    }, tier);

    if (image.image) {
        const imgReadStream = new hummus.PDFRStreamForBuffer(image.image);
        const imageXObject = pdf.createImageXObjectFromJPG(imgReadStream);

        const page = pdf.createPage(0, 0, item.width, item.height);
        const ctx = pdf.startPageContentContext(page);

        ctx.q()
            .cm(item.width, 0, 0, item.height, 0, 0)
            .doXObject(imageXObject)
            .Q();

        if (font && text)
            await addText(ctx, font, text);

        pdf.writePage(page);
    }
}

async function addText(ctx: hummus.PageContentContext, font: hummus.UsedFont, text: Text) {
    const words = await readAlto(getFullPath(text));
    words.forEach(word => {
        const size = word.height / font.calculateTextDimensions(word.word, 1).height;
        const dim = font.calculateTextDimensions(word.word, size);

        ctx.BT() // Begin text
            .Tr(3) // Invisible text mode
            .Tf(font, size) // Font and size
            .Tz(word.width / dim.width * 100) // Horizontal scale (exact width)
            .Tm(1, 0, 0, 1, word.x - dim.xMin, word.y - word.height - dim.yMin) // Transformation matrix, position of text
            .Tj(word.word) // The text
            .ET(); // End text
    });
}
