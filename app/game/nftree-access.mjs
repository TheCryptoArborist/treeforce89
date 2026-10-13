export const NFTREE_TYPE = '0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT';
const address = value => {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{1,64}$/i.test(value)) throw Error('Invalid Sui address.');
  return '0x' + value.slice(2).toLowerCase().padStart(64, '0');
};
const capType = '0x' + '2'.padStart(64, '0') + '::kiosk::KioskOwnerCap';
const owned = (object, owner) => object.owner?.$kind === 'AddressOwner' && address(object.owner.AddressOwner) === owner;
/** Read-only casual game access. No transaction, message signature or NFT transfer. */
export async function findNFTree(core, payer, signal) {
  const owner = address(payer);
  async function* pages(method, options, field) {
    let cursor = null;
    for (let page = 0; page < 100; page++) {
      const result = await core[method]({ ...options, cursor, limit: 50, signal });
      if (!Array.isArray(result[field])) throw Error('Invalid ownership response.');
      yield result[field];
      if (!result.hasNextPage) return;
      if (!result.cursor || result.cursor === cursor) throw Error('Invalid ownership pagination.');
      cursor = result.cursor;
    }
    throw Error('Ownership scan is too large. Please retry.');
  }
  for await (const objects of pages('listOwnedObjects', { owner, type: NFTREE_TYPE }, 'objects')) {
    const nft = objects.find(o => o.type === NFTREE_TYPE && owned(o, owner));
    if (nft) return { objectId: nft.objectId, location: 'wallet' };
  }
  for await (const caps of pages('listOwnedObjects', { owner, type: capType, include: { content: true } }, 'objects')) {
    for (const cap of caps) {
      if (cap.type !== capType || !owned(cap, owner)) continue;
      // Canonical KioskOwnerCap BCS: UID (32 bytes), for: ID (32 bytes).
      if (!(cap.content instanceof Uint8Array) || cap.content.length !== 64) throw Error('Unable to read kiosk ownership.');
      const kiosk = '0x' + Array.from(cap.content.slice(32), b => b.toString(16).padStart(2, '0')).join('');
      for await (const fields of pages('listDynamicFields', { parentId: kiosk }, 'dynamicFields')) {
        for (const field of fields) {
          if (field.$kind !== 'DynamicObject' || field.valueType !== NFTREE_TYPE) continue;
          const { object } = await core.getObject({ objectId: field.childId, signal });
          if (object.type === NFTREE_TYPE && object.owner?.$kind === 'ObjectOwner' && [kiosk, field.fieldId].filter(Boolean).some(parent => address(object.owner.ObjectOwner) === address(parent)))
            return { objectId: object.objectId, location: 'kiosk' };
        }
      }
    }
  }
  return null;
}
