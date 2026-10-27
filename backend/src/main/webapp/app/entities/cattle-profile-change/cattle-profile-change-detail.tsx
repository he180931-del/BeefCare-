import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './cattle-profile-change.reducer';

export const CattleProfileChangeDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const cattleProfileChangeEntity = useAppSelector(state => state.cattleProfileChange.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="cattleProfileChangeDetailsHeading">Cattle Profile Change</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{cattleProfileChangeEntity.id}</dd>
          <dt>
            <span id="fieldName">Field Name</span>
            <OverlayTrigger overlay={<Tooltip>ERD: field</Tooltip>}>
              <span id="fieldName" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{cattleProfileChangeEntity.fieldName}</dd>
          <dt>
            <span id="oldValue">Old Value</span>
          </dt>
          <dd>{cattleProfileChangeEntity.oldValue}</dd>
          <dt>
            <span id="newValue">New Value</span>
          </dt>
          <dd>{cattleProfileChangeEntity.newValue}</dd>
          <dt>
            <span id="effectiveDate">Effective Date</span>
          </dt>
          <dd>
            {cattleProfileChangeEntity.effectiveDate ? (
              <TextFormat value={cattleProfileChangeEntity.effectiveDate} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="reason">Reason</span>
          </dt>
          <dd>{cattleProfileChangeEntity.reason}</dd>
          <dt>Cattle</dt>
          <dd>{cattleProfileChangeEntity.cattle ? cattleProfileChangeEntity.cattle.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/cattle-profile-change" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/cattle-profile-change/${cattleProfileChangeEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default CattleProfileChangeDetail;
