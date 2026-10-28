import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import {} from 'react-jhipster';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './calf-outcome.reducer';

export const CalfOutcomeDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const calfOutcomeEntity = useAppSelector(state => state.calfOutcome.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="calfOutcomeDetailsHeading">Calf Outcome</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{calfOutcomeEntity.id}</dd>
          <dt>
            <span id="outcome">Outcome</span>
            <OverlayTrigger overlay={<Tooltip>LIVE | STILLBORN</Tooltip>}>
              <span id="outcome" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{calfOutcomeEntity.outcome}</dd>
          <dt>
            <span id="sex">Sex</span>
          </dt>
          <dd>{calfOutcomeEntity.sex}</dd>
          <dt>
            <span id="birthWeight">Birth Weight</span>
          </dt>
          <dd>{calfOutcomeEntity.birthWeight}</dd>
          <dt>
            <span id="registrationState">Registration State</span>
          </dt>
          <dd>{calfOutcomeEntity.registrationState}</dd>
          <dt>Calving</dt>
          <dd>{calfOutcomeEntity.calving ? calfOutcomeEntity.calving.id : ''}</dd>
          <dt>Registered Cattle</dt>
          <dd>{calfOutcomeEntity.registeredCattle ? calfOutcomeEntity.registeredCattle.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/calf-outcome" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/calf-outcome/${calfOutcomeEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default CalfOutcomeDetail;
