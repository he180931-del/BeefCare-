import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './reproduction-event.reducer';

export const ReproductionEventDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const reproductionEventEntity = useAppSelector(state => state.reproductionEvent.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="reproductionEventDetailsHeading">Reproduction Event</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{reproductionEventEntity.id}</dd>
          <dt>
            <span id="type">Type</span>
            <OverlayTrigger overlay={<Tooltip>ESTRUS | BREEDING | PREGNANCY_CHECK</Tooltip>}>
              <span id="type" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{reproductionEventEntity.type}</dd>
          <dt>
            <span id="eventTime">Event Time</span>
          </dt>
          <dd>
            {reproductionEventEntity.eventTime ? (
              <TextFormat value={reproductionEventEntity.eventTime} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="method">Method</span>
          </dt>
          <dd>{reproductionEventEntity.method}</dd>
          <dt>
            <span id="result">Result</span>
          </dt>
          <dd>{reproductionEventEntity.result}</dd>
          <dt>
            <span id="source">Source</span>
          </dt>
          <dd>{reproductionEventEntity.source}</dd>
          <dt>Cattle</dt>
          <dd>{reproductionEventEntity.cattle ? reproductionEventEntity.cattle.id : ''}</dd>
          <dt>Linked Event</dt>
          <dd>{reproductionEventEntity.linkedEvent ? reproductionEventEntity.linkedEvent.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/reproduction-event" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/reproduction-event/${reproductionEventEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default ReproductionEventDetail;
