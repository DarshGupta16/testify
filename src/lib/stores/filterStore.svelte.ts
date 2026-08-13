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

	setSort(sort: SortOption) {
		this.sortBy = sort;
	}

	reset() {
		this.searchQuery = '';
		this.selectedCategory = 'All';
		this.sortBy = 'newest';
	}

	/**
	 * Pure function to apply current search, category, and sort criteria on a list of tests.
	 */
	apply(tests: TestItem[]): TestItem[] {
		let list = [...tests];

		// Category filtering
		if (this.selectedCategory !== 'All') {
			const targetCat = this.selectedCategory.toLowerCase();
			list = list.filter(
				(t) =>
					t.subject.toLowerCase() === targetCat ||
					t.tags.some((tag) => tag.toLowerCase() === targetCat)
			);
		}

		// Search query filtering
		const query = this.searchQuery.trim().toLowerCase();
		if (query) {
			list = list.filter(
				(t) =>
					t.title.toLowerCase().includes(query) ||
					t.subject.toLowerCase().includes(query) ||
					t.testFileName.toLowerCase().includes(query) ||
					t.tags.some((tag) => tag.toLowerCase().includes(query))
			);
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
				return list.sort((a, b) => b.questionCount - a.questionCount);
			case 'questions-asc':
				return list.sort((a, b) => a.questionCount - b.questionCount);
			case 'duration-desc':
				return list.sort((a, b) => b.durationMinutes - a.durationMinutes);
			case 'title-asc':
				return list.sort((a, b) => a.title.localeCompare(b.title));
			default:
				return list;
		}
	}
}
