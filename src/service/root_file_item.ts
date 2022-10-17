import {Item} from '../lib/ItemInterfaces.js';
import {RootItemChildItemsParams} from '../lib/ServiceTypes.js';

export default async function getRootFileItem({rootItem, childItems}: RootItemChildItemsParams): Promise<Item> {
    return childItems[0];
}
