import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import AnnouncementRecipient from './announcement-recipient';
import AnnouncementRecipientDeleteDialog from './announcement-recipient-delete-dialog';
import AnnouncementRecipientDetail from './announcement-recipient-detail';
import AnnouncementRecipientUpdate from './announcement-recipient-update';

const AnnouncementRecipientRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<AnnouncementRecipient />} />
    <Route path="new" element={<AnnouncementRecipientUpdate />} />
    <Route path=":id">
      <Route index element={<AnnouncementRecipientDetail />} />
      <Route path="edit" element={<AnnouncementRecipientUpdate />} />
      <Route path="delete" element={<AnnouncementRecipientDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default AnnouncementRecipientRoutes;
