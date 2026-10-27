import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './payment.reducer';

export const PaymentDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const paymentEntity = useAppSelector(state => state.payment.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="paymentDetailsHeading">Payment</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{paymentEntity.id}</dd>
          <dt>
            <span id="quoteRef">Quote Ref</span>
          </dt>
          <dd>{paymentEntity.quoteRef}</dd>
          <dt>
            <span id="durationYears">Duration Years</span>
            <OverlayTrigger overlay={<Tooltip>ERD: varchar(255); giá trị 1, 2 hoặc 3 năm</Tooltip>}>
              <span id="durationYears" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{paymentEntity.durationYears}</dd>
          <dt>
            <span id="amountVnd">Amount Vnd</span>
          </dt>
          <dd>{paymentEntity.amountVnd}</dd>
          <dt>
            <span id="state">State</span>
            <OverlayTrigger overlay={<Tooltip>PENDING | PAID | EXPIRED</Tooltip>}>
              <span id="state" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{paymentEntity.state}</dd>
          <dt>
            <span id="expiresAt">Expires At</span>
          </dt>
          <dd>{paymentEntity.expiresAt ? <TextFormat value={paymentEntity.expiresAt} type="date" format={APP_DATE_FORMAT} /> : null}</dd>
          <dt>
            <span id="purchasedStart">Purchased Start</span>
            <OverlayTrigger overlay={<Tooltip>ERD: purchased_start/end varchar(255) - tách 2 cột thời điểm, chỉ có khi PAID</Tooltip>}>
              <span id="purchasedStart" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>
            {paymentEntity.purchasedStart ? <TextFormat value={paymentEntity.purchasedStart} type="date" format={APP_DATE_FORMAT} /> : null}
          </dd>
          <dt>
            <span id="purchasedEnd">Purchased End</span>
          </dt>
          <dd>
            {paymentEntity.purchasedEnd ? <TextFormat value={paymentEntity.purchasedEnd} type="date" format={APP_DATE_FORMAT} /> : null}
          </dd>
          <dt>Subscription</dt>
          <dd>{paymentEntity.subscription ? paymentEntity.subscription.id : ''}</dd>
          <dt>Requested By</dt>
          <dd>{paymentEntity.requestedBy ? paymentEntity.requestedBy.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/payment" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/payment/${paymentEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default PaymentDetail;
