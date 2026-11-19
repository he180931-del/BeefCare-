import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import TicketMessage from './ticket-message';
import TicketMessageDeleteDialog from './ticket-message-delete-dialog';
import TicketMessageDetail from './ticket-message-detail';
import TicketMessageUpdate from './ticket-message-update';

const TicketMessageRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<TicketMessage />} />
    <Route path="new" element={<TicketMessageUpdate />} />
    <Route path=":id">
      <Route index element={<TicketMessageDetail />} />
      <Route path="edit" element={<TicketMessageUpdate />} />
      <Route path="delete" element={<TicketMessageDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default TicketMessageRoutes;
