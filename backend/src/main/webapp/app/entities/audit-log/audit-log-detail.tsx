import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './audit-log.reducer';

export const AuditLogDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const auditLogEntity = useAppSelector(state => state.auditLog.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="auditLogDetailsHeading">Audit Log</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{auditLogEntity.id}</dd>
          <dt>
            <span id="action">Action</span>
          </dt>
          <dd>{auditLogEntity.action}</dd>
          <dt>
            <span id="targetType">Target Type</span>
            <OverlayTrigger overlay={<Tooltip>ERD: target_type/id - tách thành 2 cột</Tooltip>}>
              <span id="targetType" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{auditLogEntity.targetType}</dd>
          <dt>
            <span id="targetId">Target Id</span>
          </dt>
          <dd>{auditLogEntity.targetId}</dd>
          <dt>
            <span id="loggedAt">Logged At</span>
            <OverlayTrigger overlay={<Tooltip>ERD: time</Tooltip>}>
              <span id="loggedAt" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{auditLogEntity.loggedAt ? <TextFormat value={auditLogEntity.loggedAt} type="date" format={APP_DATE_FORMAT} /> : null}</dd>
          <dt>Actor</dt>
          <dd>{auditLogEntity.actor ? auditLogEntity.actor.id : ''}</dd>
          <dt>Farm</dt>
          <dd>{auditLogEntity.farm ? auditLogEntity.farm.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/audit-log" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/audit-log/${auditLogEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default AuditLogDetail;
