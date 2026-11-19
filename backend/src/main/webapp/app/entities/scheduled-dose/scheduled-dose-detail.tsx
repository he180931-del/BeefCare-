import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './scheduled-dose.reducer';

export const ScheduledDoseDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const scheduledDoseEntity = useAppSelector(state => state.scheduledDose.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="scheduledDoseDetailsHeading">Scheduled Dose</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{scheduledDoseEntity.id}</dd>
          <dt>
            <span id="doseNo">Dose No</span>
          </dt>
          <dd>{scheduledDoseEntity.doseNo}</dd>
          <dt>
            <span id="dueDate">Due Date</span>
          </dt>
          <dd>
            {scheduledDoseEntity.dueDate ? (
              <TextFormat value={scheduledDoseEntity.dueDate} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="status">Status</span>
            <OverlayTrigger overlay={<Tooltip>PLANNED | DONE | DEFERRED | CANCELLED</Tooltip>}>
              <span id="status" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{scheduledDoseEntity.status}</dd>
          <dt>
            <span id="deferralReason">Deferral Reason</span>
          </dt>
          <dd>{scheduledDoseEntity.deferralReason}</dd>
          <dt>
            <span id="newExpectedDate">New Expected Date</span>
          </dt>
          <dd>
            {scheduledDoseEntity.newExpectedDate ? (
              <TextFormat value={scheduledDoseEntity.newExpectedDate} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>Vaccination</dt>
          <dd>{scheduledDoseEntity.vaccination ? scheduledDoseEntity.vaccination.id : ''}</dd>
          <dt>Schedule</dt>
          <dd>{scheduledDoseEntity.schedule ? scheduledDoseEntity.schedule.id : ''}</dd>
          <dt>Cattle</dt>
          <dd>{scheduledDoseEntity.cattle ? scheduledDoseEntity.cattle.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/scheduled-dose" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/scheduled-dose/${scheduledDoseEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default ScheduledDoseDetail;
