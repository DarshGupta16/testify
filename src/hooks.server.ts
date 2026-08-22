import { error, type Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
	// Block internal development and testing workbench routes in production environments
	if (!dev && event.url.pathname.startsWith('/pdftest')) {
		error(404, 'Not Found');
	}

	return resolve(event);
};
