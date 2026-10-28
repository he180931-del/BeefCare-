import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './herd-exit.reducer';

export const HerdExitDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const herdExitEntity = useAppSelector(state => state.herdExit.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="herdExitDetailsHeading">Herd Exit</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{herdExitEntity.id}</dd>
          <dt>
            <span id="type">Type</span>
            <OverlayTrigger overlay={<Tooltip>SALE | DEATH | CULL | OTHER</Tooltip>}>
              <span id="type" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{herdExitEntity.type}</dd>
          <dt>
            <span id="exitDate">Exit Date</span>
          </dt>
          <dd>
            {herdExitEntity.exitDate ? <TextFormat value={herdExitEntity.exitDate} type="date" format={APP_LOCAL_DATE_FORMAT} /> : null}
          </dd>
          <dt>
            <span id="reason">Reason</span>
          </dt>
          <dd>{herdExitEntity.reason}</dd>
          <dt>Cattle</dt>
          <dd>{herdExitEntity.cattle ? herdExitEntity.cattle.id : ''}</dd>
          <dt>Confirmed By</dt>
          <dd>{herdExitEntity.confirmedBy ? herdExitEntity.confirmedBy.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/herd-exit" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/herd-exit/${herdExitEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default HerdExitDetail;
