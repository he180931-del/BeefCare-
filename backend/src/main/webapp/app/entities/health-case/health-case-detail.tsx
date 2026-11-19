import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './health-case.reducer';

export const HealthCaseDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const healthCaseEntity = useAppSelector(state => state.healthCase.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="healthCaseDetailsHeading">Health Case</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{healthCaseEntity.id}</dd>
          <dt>
            <span id="openedDate">Opened Date</span>
          </dt>
          <dd>
            {healthCaseEntity.openedDate ? (
              <TextFormat value={healthCaseEntity.openedDate} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="status">Status</span>
          </dt>
          <dd>{healthCaseEntity.status}</dd>
          <dt>
            <span id="outcome">Outcome</span>
          </dt>
          <dd>{healthCaseEntity.outcome}</dd>
          <dt>
            <span id="closedDate">Closed Date</span>
          </dt>
          <dd>
            {healthCaseEntity.closedDate ? (
              <TextFormat value={healthCaseEntity.closedDate} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>Cattle</dt>
          <dd>{healthCaseEntity.cattle ? healthCaseEntity.cattle.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/health-case" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/health-case/${healthCaseEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default HealthCaseDetail;
