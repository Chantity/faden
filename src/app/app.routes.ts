import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/lists/lists-page').then((m) => m.ListsPage),
  },
  {
    path: 'zettel/:id',
    loadComponent: () =>
      import('./features/list-detail/list-detail-page').then((m) => m.ListDetailPage),
  },
  {
    path: 'vorlagen',
    loadComponent: () =>
      import('./features/templates/templates-page').then((m) => m.TemplatesPage),
  },
  {
    path: 'einstellungen',
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  {
    path: 'einstellungen/fortgeschritten',
    loadComponent: () => import('./features/settings/advanced-page').then((m) => m.AdvancedPage),
  },
  { path: '**', redirectTo: '' },
];
