import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './treatment.reducer';

export const TreatmentDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const treatmentEntity = useAppSelector(state => state.treatment.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="treatmentDetailsHeading">Treatment</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{treatmentEntity.id}</dd>
          <dt>
            <span id="treatmentTime">Treatment Time</span>
          </dt>
          <dd>
            {treatmentEntity.treatmentTime ? (
              <TextFormat value={treatmentEntity.treatmentTime} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="entryTime">Entry Time</span>
          </dt>
          <dd>
            {treatmentEntity.entryTime ? <TextFormat value={treatmentEntity.entryTime} type="date" format={APP_DATE_FORMAT} /> : null}
          </dd>
          <dt>
            <span id="treatmentDetail">Treatment Detail</span>
          </dt>
          <dd>{treatmentEntity.treatmentDetail}</dd>
          <dt>
            <span id="dose">Dose</span>
            <OverlayTrigger overlay={<Tooltip>ERD: dose / route - tách 2 cột</Tooltip>}>
              <span id="dose" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{treatmentEntity.dose}</dd>
          <dt>
            <span id="route">Route</span>
          </dt>
          <dd>{treatmentEntity.route}</dd>
          <dt>
            <span id="withdrawalPeriod">Withdrawal Period</span>
          </dt>
          <dd>{treatmentEntity.withdrawalPeriod}</dd>
          <dt>
            <span id="result">Result</span>
          </dt>
          <dd>{treatmentEntity.result}</dd>
          <dt>Health Case</dt>
          <dd>{treatmentEntity.healthCase ? treatmentEntity.healthCase.id : ''}</dd>
          <dt>Medicine</dt>
          <dd>{treatmentEntity.medicine ? treatmentEntity.medicine.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/treatment" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/treatment/${treatmentEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default TreatmentDetail;
