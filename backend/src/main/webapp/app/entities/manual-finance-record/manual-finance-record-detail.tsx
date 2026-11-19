import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './manual-finance-record.reducer';

export const ManualFinanceRecordDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const manualFinanceRecordEntity = useAppSelector(state => state.manualFinanceRecord.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="manualFinanceRecordDetailsHeading">Manual Finance Record</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{manualFinanceRecordEntity.id}</dd>
          <dt>
            <span id="type">Type</span>
            <OverlayTrigger overlay={<Tooltip>INCOME | EXPENSE</Tooltip>}>
              <span id="type" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{manualFinanceRecordEntity.type}</dd>
          <dt>
            <span id="category">Category</span>
          </dt>
          <dd>{manualFinanceRecordEntity.category}</dd>
          <dt>
            <span id="amountVnd">Amount Vnd</span>
          </dt>
          <dd>{manualFinanceRecordEntity.amountVnd}</dd>
          <dt>
            <span id="occurredOn">Occurred On</span>
          </dt>
          <dd>
            {manualFinanceRecordEntity.occurredOn ? (
              <TextFormat value={manualFinanceRecordEntity.occurredOn} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="state">State</span>
            <OverlayTrigger overlay={<Tooltip>DRAFT | POSTED | VOID</Tooltip>}>
              <span id="state" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{manualFinanceRecordEntity.state}</dd>
          <dt>Farm</dt>
          <dd>{manualFinanceRecordEntity.farm ? manualFinanceRecordEntity.farm.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/manual-finance-record" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/manual-finance-record/${manualFinanceRecordEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default ManualFinanceRecordDetail;
