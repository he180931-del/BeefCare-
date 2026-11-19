import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import FarmAnnouncement from './farm-announcement';
import FarmAnnouncementDeleteDialog from './farm-announcement-delete-dialog';
import FarmAnnouncementDetail from './farm-announcement-detail';
import FarmAnnouncementUpdate from './farm-announcement-update';

const FarmAnnouncementRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<FarmAnnouncement />} />
    <Route path="new" element={<FarmAnnouncementUpdate />} />
    <Route path=":id">
      <Route index element={<FarmAnnouncementDetail />} />
      <Route path="edit" element={<FarmAnnouncementUpdate />} />
      <Route path="delete" element={<FarmAnnouncementDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default FarmAnnouncementRoutes;
