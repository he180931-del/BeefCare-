import React, { useEffect } from 'react';
import { Alert, Col, Row } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { activateAction, reset } from './activate.reducer';

const successAlert = (
  <Alert variant="success">
    <strong>Tài khoản của bạn đã được kích hoạt.</strong> Bạn vui lòng
    <Link to="/login" className="alert-link">
      đăng nhập
    </Link>
    .
  </Alert>
);

const failureAlert = (
  <Alert variant="danger">
    <strong>Không thể kích hoạt tài khoản của bạn.</strong> Vui lòng quay lại trang đăng ký để tạo tài khoản.
  </Alert>
);

export const ActivatePage = () => {
  const dispatch = useAppDispatch();

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const key = searchParams.get('key');

    dispatch(activateAction(key!));
    return () => {
      dispatch(reset());
    };
  }, []);

  const { activationSuccess, activationFailure } = useAppSelector(state => state.activate);

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h1>Kích hoạt</h1>
          {activationSuccess ? successAlert : undefined}
          {activationFailure ? failureAlert : undefined}
        </Col>
      </Row>
    </div>
  );
};

export default ActivatePage;
