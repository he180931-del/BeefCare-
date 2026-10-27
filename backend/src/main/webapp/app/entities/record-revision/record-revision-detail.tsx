import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './record-revision.reducer';

export const RecordRevisionDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const recordRevisionEntity = useAppSelector(state => state.recordRevision.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="recordRevisionDetailsHeading">Record Revision</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{recordRevisionEntity.id}</dd>
          <dt>
            <span id="sourceType">Source Type</span>
            <OverlayTrigger overlay={<Tooltip>ERD: source_type + source_id - tách 2 cột</Tooltip>}>
              <span id="sourceType" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{recordRevisionEntity.sourceType}</dd>
          <dt>
            <span id="sourceId">Source Id</span>
          </dt>
          <dd>{recordRevisionEntity.sourceId}</dd>
          <dt>
            <span id="action">Action</span>
            <OverlayTrigger overlay={<Tooltip>CORRECT | VOID</Tooltip>}>
              <span id="action" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{recordRevisionEntity.action}</dd>
          <dt>
            <span id="reason">Reason</span>
          </dt>
          <dd>{recordRevisionEntity.reason}</dd>
          <dt>
            <span id="beforeSnapshot">Before Snapshot</span>
            <OverlayTrigger overlay={<Tooltip>ERD: before / after - tách 2 cột</Tooltip>}>
              <span id="beforeSnapshot" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{recordRevisionEntity.beforeSnapshot}</dd>
          <dt>
            <span id="afterSnapshot">After Snapshot</span>
          </dt>
          <dd>{recordRevisionEntity.afterSnapshot}</dd>
          <dt>
            <span id="changedAt">Changed At</span>
            <OverlayTrigger overlay={<Tooltip>ERD: time</Tooltip>}>
              <span id="changedAt" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>
            {recordRevisionEntity.changedAt ? (
              <TextFormat value={recordRevisionEntity.changedAt} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
        </dl>
        <Button as={Link as any} to="/record-revision" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/record-revision/${recordRevisionEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default RecordRevisionDetail;
