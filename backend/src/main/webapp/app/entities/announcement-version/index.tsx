import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import AnnouncementVersion from './announcement-version';
import AnnouncementVersionDeleteDialog from './announcement-version-delete-dialog';
import AnnouncementVersionDetail from './announcement-version-detail';
import AnnouncementVersionUpdate from './announcement-version-update';

const AnnouncementVersionRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<AnnouncementVersion />} />
    <Route path="new" element={<AnnouncementVersionUpdate />} />
    <Route path=":id">
      <Route index element={<AnnouncementVersionDetail />} />
      <Route path="edit" element={<AnnouncementVersionUpdate />} />
      <Route path="delete" element={<AnnouncementVersionDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default AnnouncementVersionRoutes;
