import type { CategoryFilter, SortOption, TestItem } from '$lib/types/test';

export class FilterStore {
	searchQuery = $state<string>('');
	selectedCategory = $state<CategoryFilter>('All');
	sortBy = $state<SortOption>('newest');

	setSearch(query: string) {
		this.searchQuery = query;
	}

	setCategory(category: CategoryFilter) {
		this.selectedCategory = category;
	}

	setSubject(subjectId: string) {
		this.selectedCategory = subjectId;
	}

	setSort(sort: SortOption) {
		this.sortBy = sort;
	}

	reset() {
		this.searchQuery = '';
		this.selectedCategory = 'All';
		this.sortBy = 'newest';
	}

	/**
	 * Pure function to apply current search, subject/category, and sort criteria on a list of tests.
	 */
	apply(tests: TestItem[], getSubjectName?: (id: string) => string): TestItem[] {
		let list = [...tests];

		// Category / Subject filtering
		if (this.selectedCategory !== 'All') {
			const target = this.selectedCategory.toLowerCase();
			list = list.filter((t) => {
				const subjectId = (t.subjectId || '').toLowerCase();
				const subjectName = getSubjectName ? getSubjectName(t.subjectId).toLowerCase() : '';

				return subjectId === target || subjectName === target;
			});
		}

		// Search query filtering
		const query = this.searchQuery.trim().toLowerCase();
		if (query) {
			list = list.filter((t) => {
				const subjectName = getSubjectName ? getSubjectName(t.subjectId).toLowerCase() : '';
				return (
					t.title.toLowerCase().includes(query) ||
					(t.subjectId || '').toLowerCase().includes(query) ||
					subjectName.includes(query) ||
					t.testFileName.toLowerCase().includes(query)
				);
			});
		}

		// Sorting
		switch (this.sortBy) {
			case 'newest':
				return list.sort(
					(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
			case 'oldest':
				return list.sort(
					(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
				);
			case 'questions-desc':
				return list.sort((a, b) => (b.questions?.length || 0) - (a.questions?.length || 0));
			case 'questions-asc':
				return list.sort((a, b) => (a.questions?.length || 0) - (b.questions?.length || 0));
			case 'duration-desc':
				return list.sort((a, b) => (b.durationMinutes ?? 0) - (a.durationMinutes ?? 0));
			case 'title-asc':
				return list.sort((a, b) => a.title.localeCompare(b.title));
			default:
				return list;
		}
	}
}
