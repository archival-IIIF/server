import {AccessParams} from '../lib/ServiceTypes.js';
import {AccessState, Access} from '../lib/Security.js';

export default async function hasAccess({item, ip, identities = []}: AccessParams): Promise<Access> {
   return {state: AccessState.OPEN};
}
