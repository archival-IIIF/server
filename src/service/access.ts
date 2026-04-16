import {AccessState} from '../lib/Security.ts';
import type {Access} from '../lib/Security.ts';
import type {AccessParams} from '../lib/ServiceTypes.ts';

export default async function hasAccess({item, ip, identities = []}: AccessParams): Promise<Access> {
   return {state: AccessState.OPEN};
}
