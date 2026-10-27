import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import AppUser from './app-user';
import AppUserDeleteDialog from './app-user-delete-dialog';
import AppUserDetail from './app-user-detail';
import AppUserUpdate from './app-user-update';

const AppUserRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<AppUser />} />
    <Route path="new" element={<AppUserUpdate />} />
    <Route path=":id">
      <Route index element={<AppUserDetail />} />
      <Route path="edit" element={<AppUserUpdate />} />
      <Route path="delete" element={<AppUserDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default AppUserRoutes;
