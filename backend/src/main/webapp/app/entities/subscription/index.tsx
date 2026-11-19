import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Subscription from './subscription';
import SubscriptionDeleteDialog from './subscription-delete-dialog';
import SubscriptionDetail from './subscription-detail';
import SubscriptionUpdate from './subscription-update';

const SubscriptionRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Subscription />} />
    <Route path="new" element={<SubscriptionUpdate />} />
    <Route path=":id">
      <Route index element={<SubscriptionDetail />} />
      <Route path="edit" element={<SubscriptionUpdate />} />
      <Route path="delete" element={<SubscriptionDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default SubscriptionRoutes;
