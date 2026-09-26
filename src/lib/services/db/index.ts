import { getActiveDatabase, type TestifyDatabase } from './database';

export * from './apiKeys';
export * from './attempts';
export * from './database';
export * from './devTraces';
export * from './docAssets';
export * from './folders';
export * from './generationJobs';
export * from './helpers';
export * from './offlineOps';
export * from './settings';
export * from './subjects';
export * from './tests';
export * from './types';

/**
 * Dynamic Proxy database instance that forwards all properties, tables,
 * and method calls to the currently active partitioned database.
 */
export const db: TestifyDatabase = new Proxy({} as TestifyDatabase, {
	get(_target, prop, _receiver) {
		const active = getActiveDatabase();
		const val = Reflect.get(active, prop, active);
		if (typeof val === 'function') {
			return val.bind(active);
		}
		return val;
	},
	set(_target, prop, value, _receiver) {
		const active = getActiveDatabase();
		return Reflect.set(active, prop, value, active);
	},
	has(_target, prop) {
		return Reflect.has(getActiveDatabase(), prop);
	},
	ownKeys(_target) {
		return Reflect.ownKeys(getActiveDatabase());
	},
	getOwnPropertyDescriptor(_target, prop) {
		return Reflect.getOwnPropertyDescriptor(getActiveDatabase(), prop);
	},
	getPrototypeOf(_target) {
		return Object.getPrototypeOf(getActiveDatabase());
	},
});
