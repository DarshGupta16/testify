/**
 * Testify - Folder Architecture Types
 *
 * Defines hierarchical folder structures for organizing tests and assessments.
 */

export interface FolderItem {
	id: string;
	name: string;
	parentFolderId: string | null;
	color?: string;
	icon?: string;
	order: number;
	createdAt: string; // ISO date string
	updatedAt: string; // ISO date string
	description?: string;
}

export interface FlattenedFolderRow {
	folder: FolderItem;
	depth: number;
	prefix: string;
	paperCount: number;
	subfolderCount: number;
}
