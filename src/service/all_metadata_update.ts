import {runTask} from '../lib/Task.js';
import {getAllRootItems} from '../lib/Item.js';
import {EmptyParams, MetadataParams} from '../lib/ServiceTypes.js';

export default async function allMetadataUpdate(noParams?: EmptyParams): Promise<void> {
    for await (const item of getAllRootItems())
        runTask<MetadataParams>('metadata', {oaiIdentifier: item.metadata_id});
}
