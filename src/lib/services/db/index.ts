import { TestifyDatabase } from './database';

export * from './apiKeys';
export * from './attempts';
export * from './database';
export * from './devTraces';
export * from './docAssets';
export * from './helpers';
export * from './settings';
export * from './subjects';
export * from './tests';
export * from './types';

/**
 * Singleton database instance
 */
export const db = new TestifyDatabase();
