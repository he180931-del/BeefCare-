import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './reminder-parameter.reducer';

export const ReminderParameterDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const reminderParameterEntity = useAppSelector(state => state.reminderParameter.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="reminderParameterDetailsHeading">Reminder Parameter</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{reminderParameterEntity.id}</dd>
          <dt>
            <span id="parameterType">Parameter Type</span>
          </dt>
          <dd>{reminderParameterEntity.parameterType}</dd>
          <dt>
            <span id="paramValue">Param Value</span>
            <OverlayTrigger overlay={<Tooltip>ERD: value</Tooltip>}>
              <span id="paramValue" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{reminderParameterEntity.paramValue}</dd>
          <dt>
            <span id="versionNo">Version No</span>
            <OverlayTrigger overlay={<Tooltip>ERD: version</Tooltip>}>
              <span id="versionNo" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{reminderParameterEntity.versionNo}</dd>
          <dt>
            <span id="effectiveFrom">Effective From</span>
          </dt>
          <dd>
            {reminderParameterEntity.effectiveFrom ? (
              <TextFormat value={reminderParameterEntity.effectiveFrom} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>Farm</dt>
          <dd>{reminderParameterEntity.farm ? reminderParameterEntity.farm.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/reminder-parameter" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/reminder-parameter/${reminderParameterEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default ReminderParameterDetail;
