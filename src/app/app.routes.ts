import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/lists/lists-page').then((m) => m.ListsPage),
    title: 'Faden – Zettel',
  },
  {
    path: 'zettel/:id',
    loadComponent: () =>
      import('./features/list-detail/list-detail-page').then((m) => m.ListDetailPage),
    title: 'Faden – Zettel',
  },
  {
    path: 'vorlagen',
    loadComponent: () =>
      import('./features/templates/templates-page').then((m) => m.TemplatesPage),
    title: 'Faden – Vorlagen',
  },
  {
    path: 'einstellungen',
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
    title: 'Faden – Einstellungen',
  },
  { path: '**', redirectTo: '' },
];
