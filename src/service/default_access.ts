import {AccessParams} from '../lib/Service';
import {AccessState, Access} from '../lib/Security';

export default async function hasAccess({item, ip, identities = []}: AccessParams): Promise<Access> {
   return {state: AccessState.OPEN};
}
