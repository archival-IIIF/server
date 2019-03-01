import config from '../../lib/Config';
import {getChildItems} from '../../lib/Item';
import {runTaskWithResponse} from '../../lib/Task';
import {IIIFMetadataParams} from '../../lib/Service';
import {MetadataItem} from '../../lib/ItemInterfaces';

import Collection from '../elem/v2/Collection';
import Base from '../elem/v2/Base';

import {IIIFMetadata} from '../../service/util/types';

const prefixFileUrl = `${config.baseUrl}/file`;
const prefixPresentationUrl = `${config.baseUrl}/iiif/presentation`;

export async function getCollection(item: MetadataItem, builder: any): Promise<Collection> {
    const collection = new Collection(`${prefixPresentationUrl}/collection/${item.id}`, item.label);

    setDefaults(collection);

    if (item.description)
        collection.setDescription(item.description);

    if (item.parent_id)
        collection.setParent(`${prefixPresentationUrl}/collection/${item.parent_id}`);

    await addMetadata(collection, item);

    const children = await getChildItems(item.id);
    await Promise.all(children.map(async childItem => {
        const child = await builder.getReference(childItem);
        if (builder.isCollection(childItem))
            collection.addCollection(child);
        else if (builder.isManifest(childItem))
            collection.addManifest(child);
    }));

    return collection;
}

export async function getReference(item: MetadataItem, builder: any): Promise<Collection> {
    return new Collection(`${prefixPresentationUrl}/collection/${item.id}`, item.label);
}

async function addMetadata(base: Base, root: MetadataItem): Promise<void> {
    if (root.authors.length > 0) {
        const authors: { [type: string]: string[] } = root.authors.reduce((acc: { [type: string]: string[] }, author) => {
            acc[author.type] ? acc[author.type].push(author.name) : acc[author.type] = [author.name];
            return acc;
        }, {});
        Object.keys(authors).forEach(type => base.addMetadata(type, authors[type]));
    }

    if (root.dates.length > 0)
        base.addMetadata('Dates', root.dates);

    if (root.physical)
        base.addMetadata('Physical description', String(root.physical));

    if (root.metadata.length > 0)
        base.addMetadata(root.metadata);

    const md = await runTaskWithResponse<IIIFMetadataParams, IIIFMetadata>('iiif-metadata', {item: root});
    if (md.homepage)
        base.setRelated(md.homepage.id, md.homepage.label);

    if (md.metadata && md.metadata.length > 0)
        base.addMetadata(md.metadata);

    if (md.seeAlso && md.seeAlso.length > 0)
        base.addSeeAlso(md.seeAlso);
}

function setDefaults(collection: Collection): void {
    collection.setContext();
    collection.setLogo(`${prefixFileUrl}/logo`);
    if (config.attribution)
        collection.setAttribution(config.attribution);
}
