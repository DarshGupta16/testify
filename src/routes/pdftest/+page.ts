import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	// Restrict testing workbench route to local development mode
	if (!dev) {
		error(404, 'Not Found');
	}
};
