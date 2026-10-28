import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './health-observation.reducer';

export const HealthObservationDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const healthObservationEntity = useAppSelector(state => state.healthObservation.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="healthObservationDetailsHeading">Health Observation</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{healthObservationEntity.id}</dd>
          <dt>
            <span id="observedTime">Observed Time</span>
          </dt>
          <dd>
            {healthObservationEntity.observedTime ? (
              <TextFormat value={healthObservationEntity.observedTime} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="entryTime">Entry Time</span>
          </dt>
          <dd>
            {healthObservationEntity.entryTime ? (
              <TextFormat value={healthObservationEntity.entryTime} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="signsProgress">Signs Progress</span>
            <OverlayTrigger overlay={<Tooltip>ERD: signs / progress</Tooltip>}>
              <span id="signsProgress" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{healthObservationEntity.signsProgress}</dd>
          <dt>
            <span id="source">Source</span>
          </dt>
          <dd>{healthObservationEntity.source}</dd>
          <dt>Health Case</dt>
          <dd>{healthObservationEntity.healthCase ? healthObservationEntity.healthCase.id : ''}</dd>
          <dt>Vaccination</dt>
          <dd>{healthObservationEntity.vaccination ? healthObservationEntity.vaccination.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/health-observation" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/health-observation/${healthObservationEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default HealthObservationDetail;
