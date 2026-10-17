// Cloud Functions のロジックを、本物の Firestore なしで確かめるための小さな代役。
// 使うのは get / set / update / delete / batch / where(==, array-contains) / limit だけ。
// 文書は「パス → データ」の Map に置く。書き込みは writes に順番で残す。

const SENTINEL = Symbol("fieldValue");

const FieldValue = {
  serverTimestamp: () => ({ [SENTINEL]: "serverTimestamp" }),
  arrayUnion: (...values) => ({ [SENTINEL]: "arrayUnion", values }),
  arrayRemove: (...values) => ({ [SENTINEL]: "arrayRemove", values }),
};

const resolve = (current, value) => {
  if (value && value[SENTINEL] === "serverTimestamp") return "TS";
  if (value && value[SENTINEL] === "arrayUnion") {
    const base = Array.isArray(current) ? current.slice() : [];
    for (const v of value.values) if (!base.includes(v)) base.push(v);
    return base;
  }
  if (value && value[SENTINEL] === "arrayRemove") {
    const base = Array.isArray(current) ? current.slice() : [];
    return base.filter((x) => !value.values.includes(x));
  }
  return value;
};

const materialize = (data, current = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) out[k] = resolve(current[k], v);
  return out;
};

class FakeFirestore {
  constructor(seed = {}) {
    this.docs = new Map(Object.entries(seed));
    this.writes = [];
    this.commits = 0;
    this.autoId = 0;
  }
  collection(path) { return new Coll(this, path); }
  batch() {
    const ops = [];
    return {
      set: (ref, data) => { ops.push(["set", ref.path, data]); },
      update: (ref, data) => { ops.push(["update", ref.path, data]); },
      delete: (ref) => { ops.push(["delete", ref.path]); },
      commit: async () => { for (const op of ops) this._apply(op); this.commits += 1; },
    };
  }
  _apply([op, path, data]) {
    if (op === "set") this.docs.set(path, materialize(data));
    else if (op === "delete") this.docs.delete(path);
    else if (op === "update") {
      const cur = this.docs.get(path);
      if (!cur) throw new Error(`update on missing doc: ${path}`);
      this.docs.set(path, { ...cur, ...materialize(data, cur) });
    }
    this.writes.push([op, path, data]);
  }
  get(path) { return this.docs.get(path); }
}

class Ref {
  constructor(db, path) { this.db = db; this.path = path; this.id = path.split("/").pop(); }
  collection(name) { return new Coll(this.db, `${this.path}/${name}`); }
  async get() {
    const data = this.db.docs.get(this.path);
    return { exists: data !== undefined, id: this.id, ref: this, data: () => (data === undefined ? undefined : { ...data }) };
  }
  async set(data) { this.db._apply(["set", this.path, data]); }
  async update(data) { this.db._apply(["update", this.path, data]); }
  async delete() { this.db._apply(["delete", this.path]); }
}

class Coll {
  constructor(db, path, filters = [], max = Infinity) { this.db = db; this.path = path; this.filters = filters; this.max = max; }
  doc(id) { return new Ref(this.db, `${this.path}/${id || `auto${++this.db.autoId}`}`); }
  where(field, op, value) { return new Coll(this.db, this.path, [...this.filters, [field, op, value]], this.max); }
  limit(n) { return new Coll(this.db, this.path, this.filters, n); }
  async get() {
    const depth = this.path.split("/").length + 1;
    const docs = [];
    for (const [path, data] of this.db.docs) {
      if (!path.startsWith(`${this.path}/`) || path.split("/").length !== depth) continue;
      const ok = this.filters.every(([f, op, v]) => {
        if (op === "==") return data[f] === v;
        if (op === "array-contains") return Array.isArray(data[f]) && data[f].includes(v);
        throw new Error(`unsupported op ${op}`);
      });
      if (!ok) continue;
      const ref = new Ref(this.db, path);
      docs.push({ id: ref.id, ref, exists: true, data: () => ({ ...data }) });
      if (docs.length >= this.max) break;
    }
    return { empty: docs.length === 0, size: docs.length, docs };
  }
}

module.exports = { FakeFirestore, FieldValue };
