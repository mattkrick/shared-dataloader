"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MAX_INT = 2147483647;
class WarehouseWorker {
    constructor(parent, operationId, sanitizer) {
        this.parent = parent;
        this.operationId = operationId;
        this.sanitizer = sanitizer;
    }
    dispose(options = {}) {
        const { force } = options;
        if (force) {
            this.parent._dispose(this.operationId);
        }
        else {
            const store = this.parent._getStore(this.operationId);
            if (store) {
                const ttl = store.shared ? this.parent._ttl : 0;
                setTimeout(this.parent._dispose, ttl, this.operationId);
            }
        }
    }
    get(dataLoaderName) {
        const storeId = this.parent.warehouseLookup[this.operationId] || this.operationId;
        const store = this.parent._getStore(storeId);
        return store.dataLoaderBase[dataLoaderName];
    }
    getID() {
        return this.operationId;
    }
    isShared() {
        const store = this.parent._getStore(this.operationId);
        return store ? store.shared : false;
    }
    sanitize() {
        if (this.sanitizer) {
            this.sanitizer();
        }
    }
    share() {
        const store = this.parent._getStore(this.operationId);
        if (!store) {
            if (!this.parent.PROD) {
                throw new Error('dataLoaderBase not found! You called shared after it was disposed');
            }
            return null;
        }
        this.sanitize();
        store.shared = true;
        return this.operationId;
    }
    useShared(mutationOpId) {
        const mutationStore = this.parent._getStore(mutationOpId);
        if (!mutationStore) {
            this.parent.warehouseLookup[this.operationId] = this.operationId;
            if (!this.parent.PROD) {
                console.warn('Mutation dataLoaderBase was already disposed!');
            }
        }
        else if (!mutationStore.shared) {
            throw new Error('Invalid access to unshared dataloader. First call dataLoader.share() in your mutation.');
        }
        else {
            this.parent.warehouseLookup[this.operationId] = mutationOpId;
        }
    }
}
class DataLoaderWarehouse {
    constructor(options) {
        this.PROD = process.env.NODE_ENV === 'production';
        this.opId = 0;
        this.warehouse = {};
        this.warehouseLookup = {};
        this._dispose = (operationId) => {
            delete this.warehouse[operationId];
            delete this.warehouseLookup[operationId];
        };
        const { ttl, onShare } = options;
        if (!ttl || isNaN(Number(ttl)) || ttl <= 0 || ttl > MAX_INT) {
            throw new Error(`ttl must be positive and no greater than ${MAX_INT}`);
        }
        this._ttl = ttl;
        this._onShare = onShare;
    }
    _getStore(operationId) {
        const store = this.warehouse[operationId];
        if (!store && !this.PROD) {
            throw new Error('dataLoaderBase not found! Perhaps you disposed early or your ttl is too short?');
        }
        return store;
    }
    add(dataLoaderBase) {
        const operationId = this.opId++;
        this.warehouse[operationId] = {
            dataLoaderBase,
            shared: false
        };
        const sanitizer = this._onShare && dataLoaderBase[this._onShare];
        return new WarehouseWorker(this, operationId, sanitizer);
    }
}
exports.default = DataLoaderWarehouse;
//# sourceMappingURL=index.js.map