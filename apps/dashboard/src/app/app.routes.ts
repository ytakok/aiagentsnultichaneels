import { Route } from '@angular/router';
export const appRoutes: Route[] = [
	{
		path: '',
		loadComponent: () => import('./inbox/inbox.component').then((module) => module.InboxComponent),
	},
	{
		path: 'channels',
		loadComponent: () =>
			import('./channels/channels.component').then((module) => module.ChannelsComponent),
	},
	{ path: '**', redirectTo: '' },
];
