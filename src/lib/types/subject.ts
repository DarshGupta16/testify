/**
 * Subject Domain Types & Default Presets with UUIDs
 */

export interface SubjectItem {
	id: string; // Unique UUID v4 string (e.g. "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d")
	name: string; // Display name, e.g. "STEM", "Computer Science", "Physics"
	color?: string; // Optional accent theme/color token
	createdAt: string; // ISO date string
}

export const DEFAULT_SUBJECT_IDS = {
	STEM: '00000000-0000-4000-8000-000000000001',
	COMPUTER_SCIENCE: '00000000-0000-4000-8000-000000000002',
	HUMANITIES: '00000000-0000-4000-8000-000000000003',
	LANGUAGES: '00000000-0000-4000-8000-000000000004',
	GENERAL: '00000000-0000-4000-8000-000000000005',
} as const;

export const DEFAULT_SUBJECTS: SubjectItem[] = [
	{ id: DEFAULT_SUBJECT_IDS.STEM, name: 'STEM', createdAt: new Date(0).toISOString() },
	{
		id: DEFAULT_SUBJECT_IDS.COMPUTER_SCIENCE,
		name: 'Computer Science',
		createdAt: new Date(0).toISOString(),
	},
	{
		id: DEFAULT_SUBJECT_IDS.HUMANITIES,
		name: 'Humanities',
		createdAt: new Date(0).toISOString(),
	},
	{ id: DEFAULT_SUBJECT_IDS.LANGUAGES, name: 'Languages', createdAt: new Date(0).toISOString() },
	{ id: DEFAULT_SUBJECT_IDS.GENERAL, name: 'General', createdAt: new Date(0).toISOString() },
];
