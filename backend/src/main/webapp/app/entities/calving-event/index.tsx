import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import CalvingEvent from './calving-event';
import CalvingEventDeleteDialog from './calving-event-delete-dialog';
import CalvingEventDetail from './calving-event-detail';
import CalvingEventUpdate from './calving-event-update';

const CalvingEventRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<CalvingEvent />} />
    <Route path="new" element={<CalvingEventUpdate />} />
    <Route path=":id">
      <Route index element={<CalvingEventDetail />} />
      <Route path="edit" element={<CalvingEventUpdate />} />
      <Route path="delete" element={<CalvingEventDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default CalvingEventRoutes;
