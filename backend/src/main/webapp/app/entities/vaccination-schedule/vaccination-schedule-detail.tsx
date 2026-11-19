import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './vaccination-schedule.reducer';

export const VaccinationScheduleDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const vaccinationScheduleEntity = useAppSelector(state => state.vaccinationSchedule.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="vaccinationScheduleDetailsHeading">Vaccination Schedule</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{vaccinationScheduleEntity.id}</dd>
          <dt>
            <span id="targetGroup">Target Group</span>
          </dt>
          <dd>{vaccinationScheduleEntity.targetGroup}</dd>
          <dt>
            <span id="firstDueDate">First Due Date</span>
          </dt>
          <dd>
            {vaccinationScheduleEntity.firstDueDate ? (
              <TextFormat value={vaccinationScheduleEntity.firstDueDate} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="doseCount">Dose Count</span>
          </dt>
          <dd>{vaccinationScheduleEntity.doseCount}</dd>
          <dt>
            <span id="intervalDays">Interval Days</span>
          </dt>
          <dd>{vaccinationScheduleEntity.intervalDays}</dd>
          <dt>
            <span id="status">Status</span>
          </dt>
          <dd>{vaccinationScheduleEntity.status}</dd>
          <dt>Farm</dt>
          <dd>{vaccinationScheduleEntity.farm ? vaccinationScheduleEntity.farm.id : ''}</dd>
          <dt>Vaccine</dt>
          <dd>{vaccinationScheduleEntity.vaccine ? vaccinationScheduleEntity.vaccine.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/vaccination-schedule" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/vaccination-schedule/${vaccinationScheduleEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default VaccinationScheduleDetail;
