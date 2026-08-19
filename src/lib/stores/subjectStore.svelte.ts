import { v4 as uuidv4 } from 'uuid';
import { db, fireAndForget, type TestifyDatabase } from '$lib/services/db';
import { DEFAULT_SUBJECTS, type SubjectItem } from '$lib/types/subject';

export class SubjectStore {
	private database: TestifyDatabase;

	subjects = $state<SubjectItem[]>([]);

	// Derived Map for O(1) reactive lookup by ID
	subjectMap = $derived.by(() => {
		const map = new Map<string, SubjectItem>();
		for (const s of this.subjects) {
			map.set(s.id, s);
			// Also index lowercase name as alias for graceful legacy fallback
			map.set(s.name.toLowerCase(), s);
		}
		return map;
	});

	constructor(customDb: TestifyDatabase = db) {
		this.database = customDb;
	}

	async init(): Promise<void> {
		try {
			const saved = await this.database.getAllSubjects();
			if (saved && saved.length > 0) {
				let hasLegacyFields = false;
				const cleaned = saved.map((s) => {
					if ('color' in s) {
						hasLegacyFields = true;
						const copy = { ...s };
						delete (copy as { color?: unknown }).color;
						return copy;
					}
					return s;
				});

				this.subjects = cleaned;

				if (hasLegacyFields) {
					fireAndForget(
						this.database.bulkSaveSubjects(cleaned),
						'Sanitizing legacy subject color field in Dexie'
					);
				}
			} else {
				// Seed with default built-in subjects
				this.subjects = [...DEFAULT_SUBJECTS];
				fireAndForget(
					this.database.bulkSaveSubjects(DEFAULT_SUBJECTS),
					'Seeding default subjects to Dexie'
				);
			}
		} catch (err) {
			console.error('[SubjectStore] Error initializing subjects:', err);
			this.subjects = [...DEFAULT_SUBJECTS];
		}
	}

	/**
	 * Resolves a subject display name by ID with graceful '?' fallback if not found.
	 * Never throws an error.
	 */
	getName(subjectId?: string): string {
		try {
			if (!subjectId) return '?';
			const item = this.subjectMap.get(subjectId);
			if (item) return item.name;

			const itemByLower = this.subjectMap.get(subjectId.toLowerCase());
			if (itemByLower) return itemByLower.name;

			return '?';
		} catch {
			return '?';
		}
	}

	/**
	 * Returns the SubjectItem object by ID.
	 */
	get(subjectId?: string): SubjectItem | undefined {
		if (!subjectId) return undefined;
		return this.subjectMap.get(subjectId) || this.subjectMap.get(subjectId.toLowerCase());
	}

	/**
	 * Adds a new subject to state with a random UUID v4 and persists to Dexie.
	 */
	addSubject(name: string): SubjectItem {
		const trimmed = name.trim();
		if (!trimmed) {
			throw new Error('Subject name cannot be empty.');
		}

		// Ensure uniqueness by name
		const existing = this.subjects.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
		if (existing) {
			throw new Error(`A subject named "${trimmed}" already exists.`);
		}

		const newSubject: SubjectItem = {
			id: uuidv4(),
			name: trimmed,
			createdAt: new Date().toISOString(),
		};

		// 1. In-memory update synchronously
		this.subjects = [...this.subjects, newSubject];

		// 2. Fire-and-forget Dexie persistence
		fireAndForget(
			this.database.saveSubject(newSubject),
			`Saving subject "${newSubject.name}" to Dexie`
		);

		return newSubject;
	}

	/**
	 * Updates / renames an existing subject.
	 */
	updateSubject(id: string, newName: string): SubjectItem {
		const trimmed = newName.trim();
		if (!trimmed) {
			throw new Error('Subject name cannot be empty.');
		}

		const existingIndex = this.subjects.findIndex((s) => s.id === id);
		if (existingIndex === -1) {
			throw new Error(`Subject with ID "${id}" not found.`);
		}

		// Ensure new name does not collide with another subject
		const duplicate = this.subjects.find(
			(s) => s.id !== id && s.name.toLowerCase() === trimmed.toLowerCase()
		);
		if (duplicate) {
			throw new Error(`Another subject named "${trimmed}" already exists.`);
		}

		const target = this.subjects[existingIndex];
		const updated: SubjectItem = {
			...target,
			name: trimmed,
		};

		// 1. In-memory update synchronously
		const newArray = [...this.subjects];
		newArray[existingIndex] = updated;
		this.subjects = newArray;

		// 2. Fire-and-forget Dexie persistence
		fireAndForget(
			this.database.saveSubject(updated),
			`Updating subject "${updated.name}" in Dexie`
		);

		return updated;
	}

	/**
	 * Deletes a subject. Prevents deletion if it's the last subject remaining.
	 */
	deleteSubject(id: string): boolean {
		if (this.subjects.length <= 1) {
			throw new Error('At least one subject must remain configured.');
		}

		const target = this.subjects.find((s) => s.id === id);
		if (!target) return false;

		// 1. In-memory update synchronously
		this.subjects = this.subjects.filter((s) => s.id !== id);

		// 2. Fire-and-forget Dexie persistence
		fireAndForget(this.database.deleteSubject(id), `Deleting subject "${target.name}" from Dexie`);

		return true;
	}
}
