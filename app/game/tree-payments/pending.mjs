/** Recovery marker only. Never store a session token, signature or verified status. */
const KEY = 'treeforce89:pending-tree-continue:v1';
export function pendingPurchase(storage) {
  return {
    save(value) { storage.setItem(KEY, JSON.stringify(value)); },
    read() { try { const text = storage.getItem(KEY); return text && text.length < 4096 ? JSON.parse(text) : null; } catch { return null; } },
    clear(runId, orderId) {
      const current = this.read();
      if (current && current.runId === runId && (!orderId || current.orderId === orderId)) storage.removeItem(KEY);
    },
  };
}
