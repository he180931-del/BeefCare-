import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './support-history.reducer';

export const SupportHistoryDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const supportHistoryEntity = useAppSelector(state => state.supportHistory.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="supportHistoryDetailsHeading">Support History</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{supportHistoryEntity.id}</dd>
          <dt>
            <span id="eventType">Event Type</span>
          </dt>
          <dd>{supportHistoryEntity.eventType}</dd>
          <dt>
            <span id="priorState">Prior State</span>
            <OverlayTrigger overlay={<Tooltip>ERD: prior/new state - tách 2 cột; priorState để trống được cho sự kiện đầu tiên</Tooltip>}>
              <span id="priorState" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{supportHistoryEntity.priorState}</dd>
          <dt>
            <span id="newState">New State</span>
          </dt>
          <dd>{supportHistoryEntity.newState}</dd>
          <dt>
            <span id="occurredAt">Occurred At</span>
            <OverlayTrigger overlay={<Tooltip>ERD: time</Tooltip>}>
              <span id="occurredAt" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>
            {supportHistoryEntity.occurredAt ? (
              <TextFormat value={supportHistoryEntity.occurredAt} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>Ticket</dt>
          <dd>{supportHistoryEntity.ticket ? supportHistoryEntity.ticket.id : ''}</dd>
          <dt>Actor</dt>
          <dd>{supportHistoryEntity.actor ? supportHistoryEntity.actor.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/support-history" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/support-history/${supportHistoryEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default SupportHistoryDetail;
