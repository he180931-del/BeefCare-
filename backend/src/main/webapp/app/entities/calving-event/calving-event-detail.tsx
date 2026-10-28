import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './calving-event.reducer';

export const CalvingEventDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const calvingEventEntity = useAppSelector(state => state.calvingEvent.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="calvingEventDetailsHeading">Calving Event</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{calvingEventEntity.id}</dd>
          <dt>
            <span id="birthTime">Birth Time</span>
          </dt>
          <dd>
            {calvingEventEntity.birthTime ? <TextFormat value={calvingEventEntity.birthTime} type="date" format={APP_DATE_FORMAT} /> : null}
          </dd>
          <dt>
            <span id="course">Course</span>
          </dt>
          <dd>{calvingEventEntity.course}</dd>
          <dt>
            <span id="damCondition">Dam Condition</span>
          </dt>
          <dd>{calvingEventEntity.damCondition}</dd>
          <dt>Dam</dt>
          <dd>{calvingEventEntity.dam ? calvingEventEntity.dam.id : ''}</dd>
          <dt>Episode</dt>
          <dd>{calvingEventEntity.episode ? calvingEventEntity.episode.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/calving-event" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/calving-event/${calvingEventEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default CalvingEventDetail;
