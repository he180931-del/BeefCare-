import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './pen-assignment.reducer';

export const PenAssignmentDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const penAssignmentEntity = useAppSelector(state => state.penAssignment.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="penAssignmentDetailsHeading">Pen Assignment</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{penAssignmentEntity.id}</dd>
          <dt>
            <span id="effectiveFrom">Effective From</span>
          </dt>
          <dd>
            {penAssignmentEntity.effectiveFrom ? (
              <TextFormat value={penAssignmentEntity.effectiveFrom} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="effectiveTo">Effective To</span>
          </dt>
          <dd>
            {penAssignmentEntity.effectiveTo ? (
              <TextFormat value={penAssignmentEntity.effectiveTo} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="source">Source</span>
            <OverlayTrigger overlay={<Tooltip>HERD_ENTRY | MOVE</Tooltip>}>
              <span id="source" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{penAssignmentEntity.source}</dd>
          <dt>
            <span id="reason">Reason</span>
          </dt>
          <dd>{penAssignmentEntity.reason}</dd>
          <dt>Cattle</dt>
          <dd>{penAssignmentEntity.cattle ? penAssignmentEntity.cattle.id : ''}</dd>
          <dt>Pen</dt>
          <dd>{penAssignmentEntity.pen ? penAssignmentEntity.pen.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/pen-assignment" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/pen-assignment/${penAssignmentEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default PenAssignmentDetail;
