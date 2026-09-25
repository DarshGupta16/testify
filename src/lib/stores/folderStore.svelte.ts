/**
 * Testify - Hierarchical Folder Store
 *
 * Svelte 5 reactive store managing folder hierarchies, active folder navigation,
 * in-memory inverted indices for O(1) folder tests and subfolders lookup,
 * cycle-breaking tree sanitization, and Dexie IndexedDB persistence.
 */

import { SvelteMap } from 'svelte/reactivity';
import { v4 as uuidv4 } from 'uuid';
import { db, fireAndForget, type TestifyDatabase } from '$lib/services/db';
import { supabase, trySupabaseOrQueue } from '$lib/services/supabase';
import type { FlattenedFolderRow, FolderItem } from '$lib/types/folder';
import type { TestItem } from '$lib/types/test';

export type { FlattenedFolderRow };

export class FolderStore {
	private database: TestifyDatabase;

	// Primary reactive state
	folders = $state<FolderItem[]>([]);
	activeFolderId = $state<string | null>(null);
	isInitialized = $state<boolean>(false);

	// In-Memory Inverted Lookup Indices
	readonly testsByFolder = new SvelteMap<string | null, string[]>();

	// Derived: In-memory inverted index for subfolders by parent folder ID (0 desync)
	readonly subfoldersByParent = $derived.by<Map<string | null, string[]>>(() => {
		const map = new Map<string | null, string[]>();
		map.set(null, []);
		for (const folder of this.folders) {
			map.set(folder.id, []);
		}
		for (const folder of this.folders) {
			const parentKey =
				folder.parentFolderId && map.has(folder.parentFolderId) ? folder.parentFolderId : null;
			const list = map.get(parentKey) ?? [];
			list.push(folder.id);
			map.set(parentKey, list);
		}
		return map;
	});

	// Derived: O(1) ID to FolderItem Map
	folderMap = $derived.by(() => {
		const map = new Map<string, FolderItem>();
		for (const f of this.folders) {
			map.set(f.id, f);
		}
		return map;
	});

	/**
	 * Computes flattened hierarchical DFS folder tree with depth, prefix, paperCount, and subfolderCount.
	 */
	computeFlattenedTree(): FlattenedFolderRow[] {
		// Group folders by parentFolderId in O(N)
		const childrenByParent = new Map<string | null, FolderItem[]>();
		childrenByParent.set(null, []);
		for (const folder of this.folders) {
			childrenByParent.set(folder.id, []);
		}
		for (const folder of this.folders) {
			const parentKey =
				folder.parentFolderId && childrenByParent.has(folder.parentFolderId)
					? folder.parentFolderId
					: null;
			const list = childrenByParent.get(parentKey) ?? [];
			list.push(folder);
			childrenByParent.set(parentKey, list);
		}

		// Sort each sibling tier by order ascending, then name
		for (const [, list] of childrenByParent) {
			list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
		}

		const result: FlattenedFolderRow[] = [];
		const visited = new Set<string>();

		const traverse = (parentId: string | null, depth: number) => {
			const children = childrenByParent.get(parentId) ?? [];
			for (const child of children) {
				if (visited.has(child.id)) continue;
				visited.add(child.id);

				const paperCount = this.getTestIdsInFolder(child.id).length;
				const subfolderCount = (childrenByParent.get(child.id) ?? []).length;

				result.push({
					folder: child,
					depth,
					prefix: '— '.repeat(depth),
					paperCount,
					subfolderCount,
				});
				traverse(child.id, depth + 1);
			}
		};

		// 1. Traverse all normal trees rooted at null
		traverse(null, 0);

		// 2. Cycle & orphan guard: handle any disconnected cycles or orphaned subtrees
		for (const folder of this.folders) {
			if (!visited.has(folder.id)) {
				visited.add(folder.id);
				const paperCount = this.getTestIdsInFolder(folder.id).length;
				const subfolderCount = (childrenByParent.get(folder.id) ?? []).length;
				result.push({
					folder,
					depth: 0,
					prefix: '',
					paperCount,
					subfolderCount,
				});
				traverse(folder.id, 1);
			}
		}

		return result;
	}

	// Derived: Flattened hierarchical folder tree with depth, prefix, paperCount, and subfolderCount
	get flattenedTree(): FlattenedFolderRow[] {
		return this.computeFlattenedTree();
	}

	// Derived: Root-level folders sorted by order
	rootFolders = $derived(
		this.folders.filter((f) => f.parentFolderId === null).sort((a, b) => a.order - b.order)
	);

	// Derived: Active FolderItem or null
	activeFolder = $derived(
		this.activeFolderId ? (this.folderMap.get(this.activeFolderId) ?? null) : null
	);

	// Derived: Hierarchical breadcrumb path with cycle guard
	activeFolderPath = $derived.by<FolderItem[]>(() => {
		if (!this.activeFolderId) return [];
		const path: FolderItem[] = [];
		const visited = new Set<string>();
		let curr: FolderItem | undefined = this.folderMap.get(this.activeFolderId);

		while (curr && !visited.has(curr.id)) {
			visited.add(curr.id);
			path.unshift(curr);
			curr = curr.parentFolderId ? this.folderMap.get(curr.parentFolderId) : undefined;
		}

		return path;
	});

	// Derived: Subfolders of active folder sorted by order
	subfolders = $derived(
		this.folders
			.filter((f) => f.parentFolderId === this.activeFolderId)
			.sort((a, b) => a.order - b.order)
	);

	constructor(customDb: TestifyDatabase = db) {
		this.database = customDb;
	}

	/**
	 * Initializes folders from IndexedDB, sanitizing orphaned nodes and breaking cycles.
	 */
	async init(): Promise<void> {
		try {
			const savedFolders = await this.database.getAllFolders();
			if (!savedFolders || savedFolders.length === 0) {
				this.folders = [];
				this.isInitialized = true;
				return;
			}

			// 1. Build ID lookup set
			const folderIds = new Set(savedFolders.map((f) => f.id));
			let hadSanitization = false;

			// 2. Sanitize orphaned subtrees (reparent to root null if parent does not exist)
			let sanitized = savedFolders.map((folder) => {
				if (folder.parentFolderId !== null && !folderIds.has(folder.parentFolderId)) {
					hadSanitization = true;
					return { ...folder, parentFolderId: null };
				}
				return folder;
			});

			// 3. Snap cycles (detect and break circular parent chains)
			const idToFolder = new Map(sanitized.map((f) => [f.id, f]));
			sanitized = sanitized.map((folder) => {
				if (folder.parentFolderId === null) return folder;

				const visitedAncestors = new Set<string>([folder.id]);
				let currentParentId: string | null = folder.parentFolderId;
				let isCycle = false;

				while (currentParentId !== null) {
					if (visitedAncestors.has(currentParentId)) {
						isCycle = true;
						break;
					}
					visitedAncestors.add(currentParentId);
					const parentObj = idToFolder.get(currentParentId);
					currentParentId = parentObj?.parentFolderId ?? null;
				}

				if (isCycle) {
					hadSanitization = true;
					return { ...folder, parentFolderId: null };
				}
				return folder;
			});

			this.folders = sanitized;
			this.isInitialized = true;

			// If any repairs were performed during sanitization, persist back to Dexie
			if (hadSanitization) {
				fireAndForget(
					this.database.bulkSaveFolders(sanitized),
					'Sanitizing repaired folder tree in Dexie'
				);
			}
		} catch (err) {
			console.error('[FolderStore] Error initializing from Dexie:', err);
			this.folders = [];
			this.isInitialized = true;
		}
	}

	/**
	 * Rebuilds in-memory inverted index testsByFolder.
	 */
	rebuildIndices(tests: TestItem[]): void {
		this.testsByFolder.clear();

		// Initialize root container
		this.testsByFolder.set(null, []);

		// Initialize buckets for all known folders
		for (const folder of this.folders) {
			this.testsByFolder.set(folder.id, []);
		}

		// Index tests by folder
		for (const test of tests) {
			const folderKey =
				test.folderId && this.testsByFolder.has(test.folderId) ? test.folderId : null;
			const list = this.testsByFolder.get(folderKey) ?? [];
			list.push(test.id);
			this.testsByFolder.set(folderKey, list);
		}
	}

	/**
	 * Creates a new folder with duplicate sibling name validation and order assignment.
	 */
	async addFolder(
		name: string,
		parentFolderId: string | null = null,
		color?: string,
		icon?: string,
		description?: string
	): Promise<FolderItem> {
		const trimmedName = name.trim();
		if (!trimmedName) {
			throw new Error('Folder name cannot be empty');
		}

		if (parentFolderId !== null && !this.folderMap.has(parentFolderId)) {
			throw new Error(`Parent folder with ID "${parentFolderId}" does not exist.`);
		}

		// Check for duplicate sibling names
		const siblings = this.folders.filter((f) => f.parentFolderId === parentFolderId);
		if (siblings.some((f) => f.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
			throw new Error(`A folder named "${trimmedName}" already exists in this location.`);
		}

		const maxOrder = siblings.reduce((max, f) => Math.max(max, f.order), -1);
		const now = new Date().toISOString();

		const newFolder: FolderItem = {
			id: uuidv4(),
			name: trimmedName,
			parentFolderId,
			color,
			icon,
			order: maxOrder + 1,
			createdAt: now,
			updatedAt: now,
			description: description?.trim() || undefined,
		};

		// 1. Reactive state update
		this.folders = [...this.folders, newFolder];

		// 2. Inverted index update
		this.testsByFolder.set(newFolder.id, []);

		// 3. Dexie persistence
		fireAndForget(
			this.database.saveFolder(newFolder),
			`Saving folder "${newFolder.name}" to Dexie`
		);

		// 4. Supabase cloud sync
		fireAndForget(
			trySupabaseOrQueue(
				async () =>
					supabase.from('folders').upsert({
						id: newFolder.id,
						name: newFolder.name,
						parent_folder_id: newFolder.parentFolderId || null,
						color: newFolder.color || null,
						icon: newFolder.icon || null,
						order_index: newFolder.order,
						description: newFolder.description || null,
						created_at: newFolder.createdAt,
						updated_at: newFolder.updatedAt,
					}),
				{ table: 'folders', action: 'create', recordId: newFolder.id, data: newFolder }
			),
			`Syncing folder "${newFolder.name}" to Supabase`
		);

		return newFolder;
	}

	/**
	 * Updates an existing folder with sibling name collision checking.
	 */
	async updateFolder(id: string, updates: Partial<FolderItem>): Promise<FolderItem> {
		const existingIndex = this.folders.findIndex((f) => f.id === id);
		if (existingIndex === -1) {
			throw new Error(`Folder with ID "${id}" was not found.`);
		}

		const existing = this.folders[existingIndex];
		const targetParentId =
			updates.parentFolderId !== undefined ? updates.parentFolderId : existing.parentFolderId;

		if (
			updates.parentFolderId !== undefined &&
			updates.parentFolderId !== null &&
			!this.folderMap.has(updates.parentFolderId)
		) {
			throw new Error(`Parent folder with ID "${updates.parentFolderId}" does not exist.`);
		}

		if (updates.name !== undefined) {
			const trimmedName = updates.name.trim();
			if (!trimmedName) {
				throw new Error('Folder name cannot be empty');
			}
			updates.name = trimmedName;

			// Check duplicate sibling names (excluding current folder)
			const siblings = this.folders.filter(
				(f) => f.parentFolderId === targetParentId && f.id !== id
			);
			if (siblings.some((f) => f.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
				throw new Error(`A folder named "${trimmedName}" already exists in this location.`);
			}
		}

		const updated: FolderItem = {
			...existing,
			...updates,
			updatedAt: new Date().toISOString(),
		};

		// Update state (derived subfoldersByParent updates automatically)
		const newFolders = [...this.folders];
		newFolders[existingIndex] = updated;
		this.folders = newFolders;

		// Dexie persistence
		fireAndForget(
			this.database.updateFolder(id, updated),
			`Updating folder "${updated.name}" in Dexie`
		);

		// Supabase persistence
		fireAndForget(
			trySupabaseOrQueue(
				async () =>
					supabase.from('folders').upsert({
						id: updated.id,
						name: updated.name,
						parent_folder_id: updated.parentFolderId || null,
						color: updated.color || null,
						icon: updated.icon || null,
						order_index: updated.order,
						description: updated.description || null,
						created_at: updated.createdAt,
						updated_at: updated.updatedAt,
					}),
				{ table: 'folders', action: 'update', recordId: updated.id, data: updated }
			),
			`Updating folder "${updated.name}" in Supabase`
		);

		return updated;
	}

	/**
	 * Moves a folder to a new parent folder with cycle detection and sibling name validation.
	 */
	async moveFolder(folderId: string, newParentFolderId: string | null): Promise<void> {
		if (folderId === newParentFolderId) {
			throw new Error('Cannot move a folder into itself.');
		}

		const target = this.folderMap.get(folderId);
		if (!target) {
			throw new Error(`Folder "${folderId}" does not exist.`);
		}

		if (target.parentFolderId === newParentFolderId) {
			return; // Already at destination
		}

		if (newParentFolderId !== null && !this.folderMap.has(newParentFolderId)) {
			throw new Error(`Parent folder with ID "${newParentFolderId}" does not exist.`);
		}

		// Cycle check: newParent cannot be a descendant of folderId
		if (newParentFolderId !== null) {
			const descendants = new Set(this.getDescendantIds(folderId));
			if (descendants.has(newParentFolderId)) {
				throw new Error('Cannot move a folder into one of its own subfolders.');
			}
		}

		// Sibling duplicate check
		const destinationSiblings = this.folders.filter(
			(f) => f.parentFolderId === newParentFolderId && f.id !== folderId
		);
		if (
			destinationSiblings.some(
				(f) => f.name.trim().toLowerCase() === target.name.trim().toLowerCase()
			)
		) {
			throw new Error(`A folder named "${target.name}" already exists in the destination folder.`);
		}

		const nextOrder = destinationSiblings.reduce((max, f) => Math.max(max, f.order), -1) + 1;
		await this.updateFolder(folderId, {
			parentFolderId: newParentFolderId,
			order: nextOrder,
		});
	}

	/**
	 * BFS traversal to collect all descendant folder IDs under a given root.
	 */
	getDescendantIds(folderId: string): string[] {
		const descendants: string[] = [];
		const queue: string[] = [folderId];
		const visited = new Set<string>([folderId]);

		while (queue.length > 0) {
			const currentId = queue.shift();
			if (!currentId) break;
			for (const f of this.folders) {
				if (f.parentFolderId === currentId && !visited.has(f.id)) {
					visited.add(f.id);
					descendants.push(f.id);
					queue.push(f.id);
				}
			}
		}

		return descendants;
	}

	/**
	 * Sets the active navigation folder.
	 */
	setActiveFolder(id: string | null): void {
		this.activeFolderId = id;
	}

	/**
	 * Mutates the in-memory inverted index when a test is assigned to a folder.
	 */
	addTestToFolderIndex(testId: string, folderId: string | null): void {
		const key = folderId && this.testsByFolder.has(folderId) ? folderId : null;
		const current = this.testsByFolder.get(key) ?? [];
		if (!current.includes(testId)) {
			this.testsByFolder.set(key, [...current, testId]);
		}
	}

	/**
	 * Mutates the in-memory inverted index when a test is removed from a folder.
	 */
	removeTestFromFolderIndex(testId: string, folderId: string | null): void {
		const key = folderId && this.testsByFolder.has(folderId) ? folderId : null;
		const current = this.testsByFolder.get(key) ?? [];
		this.testsByFolder.set(
			key,
			current.filter((id) => id !== testId)
		);
	}

	/**
	 * Mutates the in-memory inverted index when a test is moved between folders.
	 */
	moveTestInIndex(testId: string, fromFolderId: string | null, toFolderId: string | null): void {
		this.removeTestFromFolderIndex(testId, fromFolderId);
		this.addTestToFolderIndex(testId, toFolderId);
	}

	/**
	 * Gets test IDs directly contained within a folder.
	 */
	getTestIdsInFolder(folderId: string | null): string[] {
		return this.testsByFolder.get(folderId) ?? [];
	}
}
