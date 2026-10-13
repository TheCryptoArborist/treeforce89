// services/canopy-credits/reader/client.mjs
import { SuiGrpcClient, GrpcWebFetchTransport } from "@mysten/sui/grpc";

// services/canopy-credits/mainnet-reader.mjs
import { Buffer as Buffer6 } from "node:buffer";
var MAINNET = Object.freeze({
  network: "sui:mainnet",
  chainIdentifier: "35834a8a",
  genesisDigest: "4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S",
  endpoint: "https://fullnode.mainnet.sui.io:443",
  treeType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE"
});
var ChainReadError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "ChainReadError";
    this.code = code;
  }
};
var requireThat = (ok, code) => {
  if (!ok) throw new ChainReadError(code);
};
var U642 = (1n << 64n) - 1n;
function decimal(value) {
  requireThat(typeof value === "bigint" || typeof value === "string", "missing-or-unsafe-integer");
  const str = String(value);
  requireThat(/^(0|[1-9][0-9]*)$/.test(str) && BigInt(str) <= U642, "invalid-u64");
  return str;
}
function canonicalAddress(value) {
  requireThat(typeof value === "string" && /^0x[0-9a-fA-F]{1,64}$/.test(value), "invalid-address");
  return "0x" + value.slice(2).toLowerCase().padStart(64, "0");
}
function digest32(value) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  requireThat(typeof value === "string" && value.length >= 32 && value.length <= 44, "invalid-digest");
  let n = 0n;
  for (const ch of value) {
    const digit = alphabet.indexOf(ch);
    requireThat(digit >= 0, "invalid-digest");
    n = n * 58n + BigInt(digit);
  }
  const leading = value.match(/^1*/)[0].length;
  const bytes = n === 0n ? 0 : Math.ceil(n.toString(16).length / 2);
  requireThat(leading + bytes === 32, "invalid-digest-size");
  return value;
}
function timestampMs(t) {
  const seconds = BigInt(decimal(t?.seconds));
  requireThat(Number.isInteger(t?.nanos) && t.nanos >= 0 && t.nanos < 1e9, "invalid-timestamp");
  const value = seconds * 1000n + BigInt(Math.floor(t.nanos / 1e6));
  requireThat(value <= BigInt(Number.MAX_SAFE_INTEGER), "timestamp-overflow");
  return Number(value);
}
function moveType(value) {
  requireThat(typeof value === "string" && value.length <= 4096 && /^0x[0-9a-fA-F]{1,64}::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*/.test(value), "invalid-move-type");
  return value.replace(/0x[0-9a-fA-F]+(?=::)/g, canonicalAddress);
}
function eventJson(value, depth = 0) {
  requireThat(depth <= 32, "event-json-too-deep");
  const k = value?.kind;
  switch (k?.oneofKind) {
    case "nullValue":
      return null;
    case "stringValue":
      requireThat(typeof k.stringValue === "string" && k.stringValue.length <= 65536, "invalid-event-json");
      return k.stringValue;
    case "boolValue":
      requireThat(typeof k.boolValue === "boolean", "invalid-event-json");
      return k.boolValue;
    case "numberValue":
      requireThat(Number.isSafeInteger(k.numberValue), "unsafe-event-number");
      return k.numberValue;
    case "listValue": {
      requireThat(Array.isArray(k.listValue?.values) && k.listValue.values.length <= 4096, "invalid-event-json");
      return k.listValue.values.map((v) => eventJson(v, depth + 1));
    }
    case "structValue": {
      requireThat(k.structValue?.fields && typeof k.structValue.fields === "object", "invalid-event-json");
      const entries = Object.entries(k.structValue.fields);
      requireThat(entries.length <= 1024, "invalid-event-json");
      return Object.fromEntries(entries.map(([key, v]) => [key, eventJson(v, depth + 1)]));
    }
    default:
      throw new ChainReadError("missing-event-json-kind");
  }
}
function normalizeNetwork(info, now = Date.now()) {
  requireThat(info?.chain === "mainnet" && info.chainId === MAINNET.genesisDigest, "wrong-mainnet-genesis");
  const stamp = timestampMs(info.timestamp);
  requireThat(Number.isSafeInteger(now) && stamp <= now + 3e4 && now - stamp <= 18e4, "stale-mainnet-endpoint");
  return Object.freeze({
    network: MAINNET.network,
    chainIdentifier: MAINNET.chainIdentifier,
    genesisDigest: info.chainId,
    checkpointHeight: decimal(info.checkpointHeight),
    observedAtMs: now,
    checkpointTimestampMs: stamp
  });
}
function normalizeMetadata(info, now = Date.now()) {
  requireThat(info?.coinType === MAINNET.treeType, "wrong-tree-coin");
  const m = info.metadata;
  requireThat(m && Number.isInteger(m.decimals) && m.decimals >= 0 && m.decimals <= 18, "missing-tree-decimals");
  const id4 = canonicalAddress(m.id);
  requireThat(!/^0x0+$/.test(id4), "invalid-metadata-id");
  requireThat(typeof m.name === "string" && m.name.length <= 256 && typeof m.symbol === "string" && m.symbol.length <= 64, "missing-tree-metadata");
  return Object.freeze({
    network: MAINNET.network,
    coinType: MAINNET.treeType,
    metadataId: id4,
    decimals: m.decimals,
    name: m.name,
    symbol: m.symbol,
    baseUnitsPerTree: (10n ** BigInt(m.decimals)).toString(),
    observedAtMs: now,
    source: "sui-grpc-state-service"
  });
}
function normalizeCheckpoint(cp, sequence) {
  requireThat(cp && decimal(cp.sequenceNumber) === decimal(sequence), "checkpoint-sequence-mismatch");
  digest32(cp.digest);
  digest32(cp.contents?.digest);
  requireThat(cp.summary?.contentDigest === cp.contents.digest, "checkpoint-content-digest-mismatch");
  const entries = cp.contents.transactions;
  requireThat(Array.isArray(entries) && entries.length <= 1e4, "incomplete-checkpoint");
  return {
    sequenceNumber: decimal(cp.sequenceNumber),
    digest: cp.digest,
    timestampMs: timestampMs(cp.summary.timestamp),
    entries
  };
}
function normalizeTransaction(tx, expectedDigest, cp, decodeReceipt = null) {
  digest32(expectedDigest);
  requireThat(tx?.digest === expectedDigest && tx.effects?.transactionDigest === expectedDigest, "transaction-digest-mismatch");
  const checkpoint = normalizeCheckpoint(cp, tx.checkpoint);
  const effectsDigest = digest32(tx.effects.digest);
  const included = checkpoint.entries.filter((e) => e.transaction === expectedDigest);
  requireThat(included.length === 1 && included[0].effects === effectsDigest, "transaction-not-in-checkpoint");
  requireThat(timestampMs(tx.timestamp) === checkpoint.timestampMs, "checkpoint-time-mismatch");
  const success = tx.effects.status?.success;
  requireThat(typeof success === "boolean" && !(success && tx.effects.status?.error), "missing-or-inconsistent-status");
  const sender = canonicalAddress(tx.transaction?.sender);
  requireThat(Array.isArray(tx.balanceChanges) && tx.balanceChanges.length <= 1e4, "incomplete-balance-changes");
  const changes = tx.balanceChanges.map((b) => {
    requireThat(typeof b.amount === "string" && /^(0|-?[1-9][0-9]*)$/.test(b.amount) && b.amount.length <= 80, "invalid-balance-change");
    return Object.freeze({ owner: canonicalAddress(b.address), coinType: moveType(b.coinType), amount: b.amount });
  });
  const eventDigest = tx.effects.eventsDigest;
  if (eventDigest) {
    requireThat(tx.events?.digest === eventDigest && Array.isArray(tx.events.events) && tx.events.events.length > 0, "missing-or-mismatched-events");
    digest32(eventDigest);
  } else requireThat(!tx.events?.events?.length && !tx.events?.digest, "unexpected-events");
  const rawEvents = tx.events?.events ?? [];
  requireThat(rawEvents.length <= 4096, "too-many-events");
  const events = rawEvents.map((e, index) => {
    if (e.eventIndex !== void 0) requireThat(e.eventIndex === index, "event-index-mismatch");
    if (e.transactionDigest !== void 0) requireThat(e.transactionDigest === expectedDigest, "event-transaction-mismatch");
    requireThat(canonicalAddress(e.sender) === sender, "event-sender-mismatch");
    requireThat(e.contents?.value instanceof Uint8Array && e.contents.value.length <= 262144, "missing-event-bcs");
    const event = {
      index: String(index),
      type: moveType(e.eventType),
      packageId: canonicalAddress(e.packageId),
      json: e.json === void 0 ? null : eventJson(e.json),
      bcsBase64: Buffer6.from(e.contents.value).toString("base64"),
      fields: null
    };
    if (decodeReceipt && event.type === decodeReceipt.eventType) {
      event.fields = decodeReceipt.decode(Object.freeze({ ...event }));
      requireThat(event.fields && typeof event.fields === "object" && !Array.isArray(event.fields), "invalid-receipt-decoder");
    }
    return Object.freeze(event);
  });
  return Object.freeze({
    digest: expectedDigest,
    status: success ? "success" : "failed",
    finalized: true,
    simulated: false,
    checkpoint: checkpoint.sequenceNumber,
    checkpointDigest: checkpoint.digest,
    effectsDigest,
    timestampMs: checkpoint.timestampMs,
    sender,
    events: Object.freeze(events),
    balanceChanges: Object.freeze(changes),
    finalitySource: "trusted-rpc-checkpoint-inclusion",
    ...tx.transaction?.kind ? { paymentReferences: paymentReferences(tx.transaction.kind) } : {}
  });
}
function paymentReferences(kind) {
  const ptb = kind?.data?.oneofKind === "programmableTransaction" ? kind.data.programmableTransaction : null;
  if (!ptb) return Object.freeze([]);
  requireThat(Array.isArray(ptb?.commands) && ptb.commands.length <= 1024 && Array.isArray(ptb.inputs), "missing-payment-transaction");
  const references = [];
  for (const command of ptb.commands) {
    const c = command.command?.oneofKind === "moveCall" ? command.command.moveCall : null;
    if (!c || canonicalAddress(c.package) !== canonicalAddress("0x1") || c.module !== "string" || c.function !== "utf8") continue;
    if (c.typeArguments?.length || c.arguments?.length !== 1 || c.arguments[0].kind !== 2 || !Number.isInteger(c.arguments[0].input)) continue;
    const input = ptb.inputs[c.arguments[0].input], bytes = input?.pure;
    if (input?.kind !== 1 || !(bytes instanceof Uint8Array) || bytes.length > 128 || bytes[0] >= 128 || bytes.length !== bytes[0] + 1) continue;
    const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(1));
    if (value.startsWith("TREE_FORCE_ENTRY_V1:")) references.push(value);
  }
  return Object.freeze(references);
}
var TX_MASK = Object.freeze([
  "digest",
  "transaction",
  "effects.digest",
  "effects.status",
  "effects.transaction_digest",
  "effects.events_digest",
  "checkpoint",
  "timestamp",
  "events",
  "balance_changes"
]);
var CHECKPOINT_MASK = Object.freeze(["sequence_number", "digest", "summary.timestamp", "summary.content_digest", "contents"]);
var TRANSIENT = /* @__PURE__ */ new Set(["UNAVAILABLE", "DEADLINE_EXCEEDED", "RESOURCE_EXHAUSTED"]);
function createMainnetReader(services, { now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), decodeReceipt = null } = {}) {
  for (const method of ["getServiceInfo", "getCoinInfo", "getTransaction", "getCheckpoint"]) requireThat(typeof services?.[method] === "function", "missing-reader-service");
  if (decodeReceipt) requireThat(typeof decodeReceipt.decode === "function" && /^0x[0-9a-f]{64}::checkout::Purchase$/.test(decodeReceipt.eventType), "invalid-receipt-codec");
  const rpc = async (method, request) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return (await services[method](request, { abort: AbortSignal.timeout(12e3) })).response;
      } catch (error) {
        if (attempt === 2 || !TRANSIENT.has(error.code)) throw error;
        await sleep(250 * (attempt + 1));
      }
    }
  };
  let identity = null;
  async function getNetworkIdentity() {
    if (identity && now() - identity.observedAtMs >= 0 && now() - identity.observedAtMs < 15e3) return identity;
    identity = normalizeNetwork(await rpc("getServiceInfo", {}), now());
    return identity;
  }
  async function readCheckpoint(sequence) {
    const request = { checkpointId: sequence === void 0 ? { oneofKind: void 0 } : { oneofKind: "sequenceNumber", sequenceNumber: BigInt(decimal(sequence)) }, readMask: { paths: [...CHECKPOINT_MASK] } };
    const { checkpoint } = await rpc("getCheckpoint", request);
    const normalized = normalizeCheckpoint(checkpoint, sequence ?? checkpoint?.sequenceNumber);
    return { raw: checkpoint, normalized };
  }
  return Object.freeze({
    getNetworkIdentity,
    async getTreeMetadata() {
      await getNetworkIdentity();
      return normalizeMetadata(await rpc("getCoinInfo", { coinType: MAINNET.treeType }), now());
    },
    async getRecentTransactionDigests(sequence) {
      await getNetworkIdentity();
      const { normalized } = await readCheckpoint(sequence);
      return Object.freeze({
        checkpoint: normalized.sequenceNumber,
        digests: normalized.entries.slice(0, 16).map((e) => digest32(e.transaction))
      });
    },
    async getFinalizedTransaction(digest) {
      digest32(digest);
      await getNetworkIdentity();
      const { transaction } = await rpc("getTransaction", { digest, readMask: { paths: [...TX_MASK] } });
      requireThat(transaction?.checkpoint !== void 0, "transaction-not-checkpointed");
      const { raw } = await readCheckpoint(decimal(transaction.checkpoint));
      return normalizeTransaction(transaction, digest, raw, decodeReceipt);
    }
  });
}

// services/canopy-credits/reader/client.mjs
var ALLOWED = /* @__PURE__ */ new Set([
  "sui.rpc.v2.LedgerService/GetServiceInfo",
  "sui.rpc.v2.LedgerService/GetTransaction",
  "sui.rpc.v2.LedgerService/GetCheckpoint",
  "sui.rpc.v2.StateService/GetCoinInfo"
]);
var ReadOnlyTransport = class extends GrpcWebFetchTransport {
  constructor() {
    super({ baseUrl: MAINNET.endpoint, format: "binary", fetchInit: { redirect: "error" } });
  }
  unary(method, input, options2) {
    if (!ALLOWED.has(`${method.service.typeName}/${method.name}`)) throw new ChainReadError("rpc-method-not-readonly-allowlisted");
    return super.unary(method, input, options2);
  }
  serverStreaming() {
    throw new ChainReadError("rpc-streaming-disabled");
  }
  clientStreaming() {
    throw new ChainReadError("rpc-streaming-disabled");
  }
  duplex() {
    throw new ChainReadError("rpc-streaming-disabled");
  }
};
function connectMainnetReader(options2) {
  const client = new SuiGrpcClient({ network: "mainnet", transport: new ReadOnlyTransport() });
  return createMainnetReader({
    getServiceInfo: (r, o) => client.ledgerService.getServiceInfo(r, o),
    getCoinInfo: (r, o) => client.stateService.getCoinInfo(r, o),
    getTransaction: (r, o) => client.ledgerService.getTransaction(r, o),
    getCheckpoint: (r, o) => client.ledgerService.getCheckpoint(r, o)
  }, options2);
}


export { connectMainnetReader };

