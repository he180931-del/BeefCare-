import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import {} from 'react-jhipster';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './internal-request.reducer';

export const InternalRequestDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const internalRequestEntity = useAppSelector(state => state.internalRequest.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="internalRequestDetailsHeading">Internal Request</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{internalRequestEntity.id}</dd>
          <dt>
            <span id="targetRole">Target Role</span>
          </dt>
          <dd>{internalRequestEntity.targetRole}</dd>
          <dt>
            <span id="state">State</span>
          </dt>
          <dd>{internalRequestEntity.state}</dd>
          <dt>
            <span id="outcome">Outcome</span>
          </dt>
          <dd>{internalRequestEntity.outcome}</dd>
          <dt>Ticket</dt>
          <dd>{internalRequestEntity.ticket ? internalRequestEntity.ticket.id : ''}</dd>
          <dt>Recipient</dt>
          <dd>{internalRequestEntity.recipient ? internalRequestEntity.recipient.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/internal-request" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/internal-request/${internalRequestEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default InternalRequestDetail;
