import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import SupportTicket from './support-ticket';
import SupportTicketDeleteDialog from './support-ticket-delete-dialog';
import SupportTicketDetail from './support-ticket-detail';
import SupportTicketUpdate from './support-ticket-update';

const SupportTicketRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<SupportTicket />} />
    <Route path="new" element={<SupportTicketUpdate />} />
    <Route path=":id">
      <Route index element={<SupportTicketDetail />} />
      <Route path="edit" element={<SupportTicketUpdate />} />
      <Route path="delete" element={<SupportTicketDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default SupportTicketRoutes;
