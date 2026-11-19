import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './bank-transfer-evidence.reducer';

export const BankTransferEvidenceDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const bankTransferEvidenceEntity = useAppSelector(state => state.bankTransferEvidence.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="bankTransferEvidenceDetailsHeading">Bank Transfer Evidence</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{bankTransferEvidenceEntity.id}</dd>
          <dt>
            <span id="providerTxnId">Provider Txn Id</span>
          </dt>
          <dd>{bankTransferEvidenceEntity.providerTxnId}</dd>
          <dt>
            <span id="amount">Amount</span>
          </dt>
          <dd>{bankTransferEvidenceEntity.amount}</dd>
          <dt>
            <span id="bankPaidAt">Bank Paid At</span>
          </dt>
          <dd>
            {bankTransferEvidenceEntity.bankPaidAt ? (
              <TextFormat value={bankTransferEvidenceEntity.bankPaidAt} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="quoteRef">Quote Ref</span>
            <OverlayTrigger overlay={<Tooltip>ERD: NOT NULL; để trống được vì SePay có thể gửi code = null</Tooltip>}>
              <span id="quoteRef" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{bankTransferEvidenceEntity.quoteRef}</dd>
          <dt>
            <span id="deliveryOutcome">Delivery Outcome</span>
            <OverlayTrigger overlay={<Tooltip>ERD: delivery/auth outcome - tách 2 cột</Tooltip>}>
              <span id="deliveryOutcome" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{bankTransferEvidenceEntity.deliveryOutcome}</dd>
          <dt>
            <span id="authOutcome">Auth Outcome</span>
          </dt>
          <dd>{bankTransferEvidenceEntity.authOutcome}</dd>
          <dt>Payment</dt>
          <dd>{bankTransferEvidenceEntity.payment ? bankTransferEvidenceEntity.payment.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/bank-transfer-evidence" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/bank-transfer-evidence/${bankTransferEvidenceEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default BankTransferEvidenceDetail;
