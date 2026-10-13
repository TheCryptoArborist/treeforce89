import { findNFTree } from './nftree-access.mjs';
import { holdGameForAccount } from './account-pause.mjs';
export function installNFTreeGateway(game, frame) {
  let disposed = false, busy = false, revision = 0, release = null;
  const panel = document.createElement('section'); panel.className = 'tree-nftree-gateway';
  const title = document.createElement('strong'); title.textContent = 'NFTREE HOLDER ACCESS';
  const note = document.createElement('p'); note.textContent = 'Own one NFTree to play. Connect your Sui wallet, then check access. No payment or signature is needed.'; note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite');
  const check = document.createElement('button'); check.type = 'button'; check.textContent = 'CHECK NFTREE ACCESS';
  const shop = document.createElement('a'); shop.href = 'https://nftree.net/'; shop.textContent = 'GET AN NFTREE'; shop.target = '_blank'; shop.rel = 'noopener noreferrer';
  const deferred = document.createElement('p'); deferred.textContent = 'TREE payments are paused. Each run starts with 3 lives; losing all lives ends the run.';
  panel.append(title, note, check, shop, deferred); frame.insertBefore(panel, frame.querySelector('.screen-bezel'));
  async function verify() {
    if (disposed || busy) return false;
    busy = true; check.disabled = true; ++revision;
    try {
      let connection = game.registry.get('treeWalletConnection');
      if (!connection) {
        note.textContent = 'Connect your Sui wallet above. No payment is requested.';
        const connect = game.registry.get('treeWalletConnect');
        if (!connect || !await connect()) return false;
        connection = game.registry.get('treeWalletConnection');
      }
      if (!connection?.address) return false;
      // Connection itself emits a change event; bind the scan after it settles.
      const scan = revision, payer = connection.address;
      note.textContent = 'Checking NFTree ownership on Sui Mainnet…';
      const kit = game.registry.get('treeWalletKit');
      const nft = await findNFTree(kit.getClient('mainnet').core, payer, AbortSignal.timeout(25000));
      if (disposed || scan !== revision || game.registry.get('treeWalletConnection')?.address !== payer) return false;
      game.registry.set('treeNFTreeAccess', nft ? { address: payer, ...nft } : null);
      note.textContent = nft ? 'NFTree verified. Press Start to play. No TREE payment is required.' : 'No NFTree found in this wallet or its standard Sui kiosks. Get an NFTree or select another account.';
      if (nft) { release?.(); release = null; }
      return !!nft;
    } catch {
      game.registry.set('treeNFTreeAccess', null);
      note.textContent = 'Access could not be verified. Check your wallet prompt or retry. No payment was requested.';
      return false;
    } finally { busy = false; check.disabled = false; }
  }
  check.onclick = () => void verify();
  const changed = () => {
    ++revision; game.registry.set('treeNFTreeAccess', null);
    note.textContent = 'Check NFTree access for your connected account.';
    if (game.scene.isActive('game') && !release) release = holdGameForAccount(game);
  };
  game.registry.set('treeNFTreeCheck', verify); game.events.on('tree-wallet:connection', changed);
  return () => { disposed = true; ++revision; release?.(); game.events.off('tree-wallet:connection', changed); game.registry.remove('treeNFTreeCheck'); game.registry.remove('treeNFTreeAccess'); panel.remove(); };
}
