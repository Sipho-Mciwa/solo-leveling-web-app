// Minimal in-memory Firestore stand-in — just enough surface (collection/
// where/limit/get, doc/get/set/update, batch, runTransaction) to exercise
// real concurrency races against the actual service code, instead of
// asserting on mocked call arguments. Every operation is async (via
// Promise.resolve) so `await`-separated steps in the real service code
// genuinely interleave when two calls run concurrently via Promise.all,
// the same way real Firestore round-trips would.

function matches(data, filter) {
  const val = data[filter.field];
  switch (filter.op) {
    case '==': return val === filter.value;
    case '>=': return val >= filter.value;
    case '<=': return val <= filter.value;
    case '<':  return val < filter.value;
    case '>':  return val > filter.value;
    default: throw new Error(`Unsupported operator: ${filter.op}`);
  }
}

class FakeQuery {
  constructor(store, collectionName, filters = [], limitN = null, order = null) {
    this.store = store;
    this.collectionName = collectionName;
    this.filters = filters;
    this.limitN = limitN;
    this.order = order;
  }

  where(field, op, value) {
    return new FakeQuery(this.store, this.collectionName, [...this.filters, { field, op, value }], this.limitN, this.order);
  }

  orderBy(field, direction = 'asc') {
    return new FakeQuery(this.store, this.collectionName, this.filters, this.limitN, { field, direction });
  }

  limit(n) {
    return new FakeQuery(this.store, this.collectionName, this.filters, n, this.order);
  }

  doc(id) {
    const docId = id ?? `auto_${Math.random().toString(36).slice(2)}`;
    return new FakeDocRef(this.store, this.collectionName, docId);
  }

  async add(data) {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }

  async get() {
    await Promise.resolve();
    const map = this.store.collection(this.collectionName);
    let entries = [...map.entries()];
    for (const f of this.filters) {
      entries = entries.filter(([, data]) => matches(data, f));
    }
    if (this.order) {
      const { field, direction } = this.order;
      const sign = direction === 'desc' ? -1 : 1;
      entries = [...entries].sort(([, a], [, b]) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * sign);
    }
    if (this.limitN != null) entries = entries.slice(0, this.limitN);
    const docs = entries.map(([id, data]) => new FakeDocSnap(this.store, this.collectionName, id, data));
    return { empty: docs.length === 0, size: docs.length, docs };
  }
}

class FakeDocRef {
  constructor(store, collectionName, id) {
    this.store = store;
    this.collectionName = collectionName;
    this.id = id;
  }

  async get() {
    await Promise.resolve();
    const map = this.store.collection(this.collectionName);
    return new FakeDocSnap(this.store, this.collectionName, this.id, map.get(this.id));
  }

  async set(data) {
    await Promise.resolve();
    this.store.collection(this.collectionName).set(this.id, { ...data });
  }

  async update(data) {
    await Promise.resolve();
    const map = this.store.collection(this.collectionName);
    map.set(this.id, { ...(map.get(this.id) || {}), ...data });
  }
}

class FakeDocSnap {
  constructor(store, collectionName, id, data) {
    this.store = store;
    this.collectionName = collectionName;
    this.id = id;
    this._data = data;
    this.exists = data !== undefined;
    this.ref = new FakeDocRef(store, collectionName, id);
  }

  data() {
    return this._data;
  }
}

class FakeFirestore {
  constructor() {
    this._collections = new Map();
  }

  collection(name) {
    if (!this._collections.has(name)) this._collections.set(name, new Map());
    return this._collections.get(name);
  }

  collectionRef(name) {
    return new FakeQuery(this, name);
  }

  batch() {
    const ops = [];
    return {
      set: (ref, data) => ops.push(() => ref.set(data)),
      update: (ref, data) => ops.push(() => ref.update(data)),
      commit: async () => {
        for (const op of ops) await op();
      },
    };
  }

  async runTransaction(fn) {
    const tx = {
      get: (refOrQuery) => refOrQuery.get(),
      set: (ref, data) => ref.set(data),
      update: (ref, data) => ref.update(data),
    };
    return fn(tx);
  }
}

// The real `db` object exposes `.collection(name)` returning a query
// builder — our store's `.collection(name)` returns the raw Map instead
// (used internally by FakeQuery/FakeDocRef), so the public fake db wires
// `.collection` to `collectionRef` for API compatibility with real Firestore.
function createFakeDb() {
  const store = new FakeFirestore();
  return {
    collection: (name) => store.collectionRef(name),
    batch: () => store.batch(),
    runTransaction: (fn) => store.runTransaction(fn),
  };
}

module.exports = { createFakeDb };
