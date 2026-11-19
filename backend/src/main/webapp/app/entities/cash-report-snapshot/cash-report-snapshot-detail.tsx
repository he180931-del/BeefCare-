import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT, APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './cash-report-snapshot.reducer';

export const CashReportSnapshotDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const cashReportSnapshotEntity = useAppSelector(state => state.cashReportSnapshot.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="cashReportSnapshotDetailsHeading">Cash Report Snapshot</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{cashReportSnapshotEntity.id}</dd>
          <dt>
            <span id="asOf">As Of</span>
          </dt>
          <dd>
            {cashReportSnapshotEntity.asOf ? (
              <TextFormat value={cashReportSnapshotEntity.asOf} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="dateFrom">Date From</span>
            <OverlayTrigger overlay={<Tooltip>ERD: date_range - tách 2 cột</Tooltip>}>
              <span id="dateFrom" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>
            {cashReportSnapshotEntity.dateFrom ? (
              <TextFormat value={cashReportSnapshotEntity.dateFrom} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="dateTo">Date To</span>
          </dt>
          <dd>
            {cashReportSnapshotEntity.dateTo ? (
              <TextFormat value={cashReportSnapshotEntity.dateTo} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="totals">Totals</span>
          </dt>
          <dd>{cashReportSnapshotEntity.totals}</dd>
          <dt>Pm User</dt>
          <dd>{cashReportSnapshotEntity.pmUser ? cashReportSnapshotEntity.pmUser.id : ''}</dd>
          <dt>Farm</dt>
          <dd>{cashReportSnapshotEntity.farm ? cashReportSnapshotEntity.farm.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/cash-report-snapshot" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/cash-report-snapshot/${cashReportSnapshotEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default CashReportSnapshotDetail;
