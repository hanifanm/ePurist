import PouchDBFind from "pouchdb-find";
import PouchDB from "pouchdb";
PouchDB.plugin(PouchDBFind);

class CouchDBWrapper {
  constructor(name, url, index) {
    this.dbRemote = new PouchDB(`${url}/${name}`, { skip_setup: true });
    this.dbLocal = new PouchDB(name, {
      auto_compaction: true,
      revs_limit: 2,
    });
    this.index = index;
    this.indexed = false;
  }

  async createIndex() {
    await this.dbLocal.createIndex({
      index: this.index,
    });
    await this.dbRemote.createIndex({
      index: this.index,
    });

    this.indexed = true;
    await this.syncDB();
  }

  async checkDB(doSync) {
    const info = await this.dbRemote.info();

    if (!info.host) {
      throw new Error("database is not connected");
    }

    if (this.index && !this.indexed) {
      await this.createIndex();
    }

    let remote = null;
    if (doSync) {
      remote = await this.syncDB();
    }

    return { info, remote };
  }

  async syncDB() {
    return this.dbLocal.replicate.from(this.dbRemote, {
      batch_size: 1000,
      batches_limit: 2,
    });
  }

  async create(input) {
    try {
      await this.checkDB(false);
      const res = await this.dbRemote.post(input);
      await this.syncDB();

      return res;
    } catch (err) {
      throw err;
    }
  }

  async update(input) {
    try {
      await this.checkDB(false);
      const res = await this.dbRemote.put(input);
      await this.syncDB();

      return res;
    } catch (err) {
      throw err;
    }
  }

  async list(query) {
    try {
      await this.checkDB(true);
      const res = await this.dbLocal.allDocs(query);
      const normalize = {
        offset: res.offset,
        total_rows: res.total_rows,
        rows: res.rows.map((val) => val.doc),
      };

      return normalize;
    } catch (err) {
      throw err;
    }
  }

  async find(query) {
    try {
      await this.checkDB(true);
      const res = await this.dbLocal.find(query);
      const normalize = {
        total_rows: res.docs.length,
        rows: res.docs,
      };

      return normalize;
    } catch (err) {
      throw err;
    }
  }

  async get(id) {
    try {
      await this.checkDB(true);
      return this.dbLocal.get(id);
    } catch (err) {
      throw err;
    }
  }
}
export default CouchDBWrapper;
