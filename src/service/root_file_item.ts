import type {Item} from '../lib/ItemInterfaces.ts';
import type {RootItemChildItemsParams} from '../lib/ServiceTypes.ts';

export default async function getRootFileItem({rootItem, childItems}: RootItemChildItemsParams): Promise<Item> {
    return childItems[0];
}
