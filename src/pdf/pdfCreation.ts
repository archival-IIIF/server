import {PDFDocument, PDFPage} from 'pdf-lib';
import {AccessTier} from '@archival-iiif/presentation-builder/v2';

import config from '../lib/Config.js';
import logger from '../lib/Logger.js';
import {ImageItem, RootItem} from '../lib/ItemInterfaces.js';

import {getImage} from '../image/imageServer.js';

export default async function createPDF(rootItem: RootItem, items: ImageItem[], tier?: AccessTier): Promise<Buffer> {
    const document = await PDFDocument.create();

    document.setTitle(rootItem.label);
    rootItem.authors.length > 0 && document.setAuthor(
        Array.isArray(rootItem.authors[0].name) ? rootItem.authors[0].name[0] : rootItem.authors[0].name);
    config.attribution && document.setProducer(config.attribution);
    config.attribution && document.setCreator(config.attribution);

    const pages = await Promise.all(items.map(async item => createPdfPage(document, item, tier)));
    for (const page of pages)
        page && document.addPage(page);

    const docBytes = await document.save();

    return Buffer.from(docBytes.buffer);
}

async function createPdfPage(document: PDFDocument, item: ImageItem, tier?: AccessTier): Promise<PDFPage | null> {
    logger.debug(`Create a PDF page for collection ${item.collection_id} with order ${item.order}; item id ${item.id}`);

    const image = await getImage(item, null, tier ? tier.maxSize : null, {
        region: 'full',
        size: config.pdfImageSize,
        rotation: '0',
        quality: 'default',
        format: 'jpg'
    });

    if (!image.image)
        return null;

    const pdfImage = await document.embedJpg(image.image);

    const page = PDFPage.create(document);
    page.setSize(item.width, item.height);
    page.drawImage(pdfImage, {
        x: 0,
        y: 0,
        width: item.width,
        height: item.height,
    });

    return page;
}
