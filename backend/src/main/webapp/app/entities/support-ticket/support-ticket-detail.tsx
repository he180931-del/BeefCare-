import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import {} from 'react-jhipster';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './support-ticket.reducer';

export const SupportTicketDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const supportTicketEntity = useAppSelector(state => state.supportTicket.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="supportTicketDetailsHeading">Support Ticket</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{supportTicketEntity.id}</dd>
          <dt>
            <span id="category">Category</span>
          </dt>
          <dd>{supportTicketEntity.category}</dd>
          <dt>
            <span id="priority">Priority</span>
          </dt>
          <dd>{supportTicketEntity.priority}</dd>
          <dt>
            <span id="status">Status</span>
          </dt>
          <dd>{supportTicketEntity.status}</dd>
          <dt>Requester</dt>
          <dd>{supportTicketEntity.requester ? supportTicketEntity.requester.id : ''}</dd>
          <dt>Farm</dt>
          <dd>{supportTicketEntity.farm ? supportTicketEntity.farm.id : ''}</dd>
          <dt>Assigned Cs</dt>
          <dd>{supportTicketEntity.assignedCs ? supportTicketEntity.assignedCs.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/support-ticket" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/support-ticket/${supportTicketEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default SupportTicketDetail;
