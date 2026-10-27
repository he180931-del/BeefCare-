import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import HerdEntry from './herd-entry';
import HerdEntryDeleteDialog from './herd-entry-delete-dialog';
import HerdEntryDetail from './herd-entry-detail';
import HerdEntryUpdate from './herd-entry-update';

const HerdEntryRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<HerdEntry />} />
    <Route path="new" element={<HerdEntryUpdate />} />
    <Route path=":id">
      <Route index element={<HerdEntryDetail />} />
      <Route path="edit" element={<HerdEntryUpdate />} />
      <Route path="delete" element={<HerdEntryDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default HerdEntryRoutes;
