import {runTask} from '../lib/Task.ts';
import {getAllRootItems} from '../lib/Item.ts';
import type {EmptyParams, MetadataParams} from '../lib/ServiceTypes.ts';

export default async function allMetadataUpdate(noParams?: EmptyParams): Promise<void> {
    for await (const item of getAllRootItems())
        runTask<MetadataParams>('metadata', {metadataId: item.metadata_id});
}
