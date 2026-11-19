import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Payment from './payment';
import PaymentDeleteDialog from './payment-delete-dialog';
import PaymentDetail from './payment-detail';
import PaymentUpdate from './payment-update';

const PaymentRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Payment />} />
    <Route path="new" element={<PaymentUpdate />} />
    <Route path=":id">
      <Route index element={<PaymentDetail />} />
      <Route path="edit" element={<PaymentUpdate />} />
      <Route path="delete" element={<PaymentDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default PaymentRoutes;
