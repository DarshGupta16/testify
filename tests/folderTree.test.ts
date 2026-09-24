/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test';
import type { FolderItem } from '../src/lib/types/folder';
import type { TestItem } from '../src/lib/types/test';

const { FolderStore } = await import('../src/lib/stores/folderStore.svelte');
const { FilterStore } = await import('../src/lib/stores/filterStore.svelte');

const mockDb = {
	getAllFolders: async () => [],
	saveFolder: async () => {},
	bulkSaveFolders: async () => {},
	updateFolder: async () => {},
	deleteFolder: async () => {},
} as unknown as import('../src/lib/services/db').TestifyDatabase;

function createFolder(
	id: string,
	name: string,
	parentFolderId: string | null,
	order: number
): FolderItem {
	return {
		id,
		name,
		parentFolderId,
		order,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
	};
}

describe('FolderStore flattenedTree', () => {
	it('computes hierarchical DFS order, depth, paperCount, and subfolderCount', () => {
		const store = new FolderStore(mockDb);
		store.folders = [
			createFolder('child-1', 'Child B', 'root-1', 1),
			createFolder('root-2', 'Root 2', null, 2),
			createFolder('child-0', 'Child A', 'root-1', 0),
			createFolder('grandchild-0', 'Grandchild A', 'child-0', 0),
			createFolder('root-1', 'Root 1', null, 1),
		];

		const mockTests = [
			{ id: 't1', folderId: 'root-1' },
			{ id: 't2', folderId: 'child-0' },
			{ id: 't3', folderId: 'child-0' },
			{ id: 't4', folderId: null },
		] as TestItem[];

		store.rebuildIndices(mockTests);

		const tree = store.flattenedTree;
		expect(tree.length).toBe(5);

		// root-1 (depth 0)
		expect(tree[0].folder.id).toBe('root-1');
		expect(tree[0].depth).toBe(0);
		expect(tree[0].paperCount).toBe(1);
		expect(tree[0].subfolderCount).toBe(2);

		// child-0 (depth 1)
		expect(tree[1].folder.id).toBe('child-0');
		expect(tree[1].depth).toBe(1);
		expect(tree[1].paperCount).toBe(2);
		expect(tree[1].subfolderCount).toBe(1);

		// grandchild-0 (depth 2)
		expect(tree[2].folder.id).toBe('grandchild-0');
		expect(tree[2].depth).toBe(2);
		expect(tree[2].paperCount).toBe(0);
		expect(tree[2].subfolderCount).toBe(0);

		// child-1 (depth 1)
		expect(tree[3].folder.id).toBe('child-1');
		expect(tree[3].depth).toBe(1);
		expect(tree[3].paperCount).toBe(0);
		expect(tree[3].subfolderCount).toBe(0);

		// root-2 (depth 0)
		expect(tree[4].folder.id).toBe('root-2');
		expect(tree[4].depth).toBe(0);
		expect(tree[4].paperCount).toBe(0);
		expect(tree[4].subfolderCount).toBe(0);

		expect(store.getTestIdsInFolder(null).length).toBe(1);
	});

	it('safely breaks circular folder dependencies without crashing or looping', () => {
		const store = new FolderStore(mockDb);
		store.folders = [
			createFolder('node-a', 'Node A', 'node-b', 0),
			createFolder('node-b', 'Node B', 'node-a', 0),
		];

		const tree = store.flattenedTree;
		expect(tree.length).toBe(2);
		const ids = tree.map((r) => r.folder.id);
		expect(ids).toContain('node-a');
		expect(ids).toContain('node-b');
	});
});

describe('FilterStore Inverted Index Integration', () => {
	const sampleTests: TestItem[] = [
		{
			id: 'test-1',
			title: 'Math Test 1',
			subjectId: 'math',
			createdAt: '2026-01-01T00:00:00.000Z',
			folderId: 'folder-a',
			testFileName: 'math1.pdf',
		} as unknown as TestItem,
		{
			id: 'test-2',
			title: 'Math Test 2',
			subjectId: 'math',
			createdAt: '2026-01-02T00:00:00.000Z',
			folderId: 'folder-a',
			testFileName: 'math2.pdf',
		} as unknown as TestItem,
		{
			id: 'test-3',
			title: 'Physics Test 1',
			subjectId: 'physics',
			createdAt: '2026-01-03T00:00:00.000Z',
			folderId: 'folder-b',
			testFileName: 'phys1.pdf',
		} as unknown as TestItem,
		{
			id: 'test-4',
			title: 'Unfiled Test',
			subjectId: 'history',
			createdAt: '2026-01-04T00:00:00.000Z',
			folderId: null,
			testFileName: 'hist1.pdf',
		} as unknown as TestItem,
	];

	it('uses getTestIdsInFolder when folderScope is current', () => {
		const filter = new FilterStore();
		filter.setFolderScope('current');

		let calledFolderId: string | null | undefined;
		const mockGetTestIds = (folderId: string | null): string[] => {
			calledFolderId = folderId;
			if (folderId === 'folder-a') return ['test-1', 'test-2'];
			if (folderId === null) return ['test-4'];
			return [];
		};

		const resultA = filter.apply(sampleTests, undefined, 'folder-a', mockGetTestIds);
		expect(calledFolderId).toBe('folder-a');
		expect(resultA.map((t) => t.id)).toEqual(['test-2', 'test-1']);

		const resultRoot = filter.apply(sampleTests, undefined, null, mockGetTestIds);
		expect(calledFolderId).toBeNull();
		expect(resultRoot.map((t) => t.id)).toEqual(['test-4']);
	});

	it('falls back gracefully to linear scanning if getTestIdsInFolder is not provided', () => {
		const filter = new FilterStore();
		filter.setFolderScope('current');

		const resultA = filter.apply(sampleTests, undefined, 'folder-a');
		expect(resultA.map((t) => t.id)).toEqual(['test-2', 'test-1']);

		const resultRoot = filter.apply(sampleTests, undefined, null);
		expect(resultRoot.map((t) => t.id)).toEqual(['test-4']);
	});

	it('includes all tests regardless of folder when folderScope is all', () => {
		const filter = new FilterStore();
		filter.setFolderScope('all');

		const mockGetTestIds = (): string[] => ['test-1'];
		const resultAll = filter.apply(sampleTests, undefined, 'folder-a', mockGetTestIds);
		expect(resultAll.length).toBe(4);
	});
});
