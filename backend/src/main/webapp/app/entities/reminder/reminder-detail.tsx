import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './reminder.reducer';

export const ReminderDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const reminderEntity = useAppSelector(state => state.reminder.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="reminderDetailsHeading">Reminder</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{reminderEntity.id}</dd>
          <dt>
            <span id="ruleType">Rule Type</span>
          </dt>
          <dd>{reminderEntity.ruleType}</dd>
          <dt>
            <span id="sourceRecord">Source Record</span>
          </dt>
          <dd>{reminderEntity.sourceRecord}</dd>
          <dt>
            <span id="dueTime">Due Time</span>
          </dt>
          <dd>{reminderEntity.dueTime ? <TextFormat value={reminderEntity.dueTime} type="date" format={APP_DATE_FORMAT} /> : null}</dd>
          <dt>
            <span id="status">Status</span>
            <OverlayTrigger overlay={<Tooltip>ACTIVE | RESOLVED | CANCELLED | SUPERSEDED</Tooltip>}>
              <span id="status" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{reminderEntity.status}</dd>
          <dt>Farm</dt>
          <dd>{reminderEntity.farm ? reminderEntity.farm.id : ''}</dd>
          <dt>Cattle</dt>
          <dd>{reminderEntity.cattle ? reminderEntity.cattle.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/reminder" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/reminder/${reminderEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default ReminderDetail;
