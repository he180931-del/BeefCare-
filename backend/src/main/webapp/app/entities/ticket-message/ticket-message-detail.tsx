import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './ticket-message.reducer';

export const TicketMessageDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const ticketMessageEntity = useAppSelector(state => state.ticketMessage.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="ticketMessageDetailsHeading">Ticket Message</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{ticketMessageEntity.id}</dd>
          <dt>
            <span id="type">Type</span>
          </dt>
          <dd>{ticketMessageEntity.type}</dd>
          <dt>
            <span id="audience">Audience</span>
          </dt>
          <dd>{ticketMessageEntity.audience}</dd>
          <dt>
            <span id="content">Content</span>
          </dt>
          <dd>{ticketMessageEntity.content}</dd>
          <dt>Ticket</dt>
          <dd>{ticketMessageEntity.ticket ? ticketMessageEntity.ticket.id : ''}</dd>
          <dt>Author</dt>
          <dd>{ticketMessageEntity.author ? ticketMessageEntity.author.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/ticket-message" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/ticket-message/${ticketMessageEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default TicketMessageDetail;
