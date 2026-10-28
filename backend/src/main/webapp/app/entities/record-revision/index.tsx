import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import RecordRevision from './record-revision';
import RecordRevisionDeleteDialog from './record-revision-delete-dialog';
import RecordRevisionDetail from './record-revision-detail';
import RecordRevisionUpdate from './record-revision-update';

const RecordRevisionRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<RecordRevision />} />
    <Route path="new" element={<RecordRevisionUpdate />} />
    <Route path=":id">
      <Route index element={<RecordRevisionDetail />} />
      <Route path="edit" element={<RecordRevisionUpdate />} />
      <Route path="delete" element={<RecordRevisionDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default RecordRevisionRoutes;
