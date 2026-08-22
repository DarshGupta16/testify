/**
 * Disjoint Set Union (DSU / Union-Find) data structure.
 * Implements path compression and union by rank for nearly O(1) amortized operations (O(alpha(N))).
 * Uses typed arrays (Int32Array / Uint8Array) for minimal memory footprint and zero GC overhead.
 */
export class DisjointSet {
	private parent: Int32Array;
	private rank: Uint8Array;

	constructor(size: number) {
		this.parent = new Int32Array(size);
		this.rank = new Uint8Array(size);
		for (let i = 0; i < size; i++) {
			this.parent[i] = i;
		}
	}

	/**
	 * Finds the representative/root of the set containing element `i`
	 * with two-pass path compression.
	 */
	find(i: number): number {
		let root = i;
		while (root !== this.parent[root]) {
			root = this.parent[root];
		}
		// Path compression
		let curr = i;
		while (curr !== root) {
			const next = this.parent[curr];
			this.parent[curr] = root;
			curr = next;
		}
		return root;
	}

	/**
	 * Merges the sets containing elements `i` and `j` using union by rank.
	 * Returns true if a merge occurred, false if elements were already in the same set.
	 */
	union(i: number, j: number): boolean {
		const rootI = this.find(i);
		const rootJ = this.find(j);

		if (rootI === rootJ) return false;

		if (this.rank[rootI] < this.rank[rootJ]) {
			this.parent[rootI] = rootJ;
		} else if (this.rank[rootI] > this.rank[rootJ]) {
			this.parent[rootJ] = rootI;
		} else {
			this.parent[rootJ] = rootI;
			this.rank[rootI]++;
		}

		return true;
	}

	/**
	 * Checks if elements `i` and `j` belong to the same connected component.
	 */
	connected(i: number, j: number): boolean {
		return this.find(i) === this.find(j);
	}
}
