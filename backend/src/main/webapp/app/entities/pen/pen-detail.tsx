import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import {} from 'react-jhipster';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './pen.reducer';

export const PenDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const penEntity = useAppSelector(state => state.pen.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="penDetailsHeading">Pen</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{penEntity.id}</dd>
          <dt>
            <span id="code">Code</span>
          </dt>
          <dd>{penEntity.code}</dd>
          <dt>
            <span id="name">Name</span>
          </dt>
          <dd>{penEntity.name}</dd>
          <dt>
            <span id="capacity">Capacity</span>
          </dt>
          <dd>{penEntity.capacity}</dd>
          <dt>
            <span id="status">Status</span>
            <OverlayTrigger overlay={<Tooltip>ACTIVE | INACTIVE</Tooltip>}>
              <span id="status" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{penEntity.status}</dd>
          <dt>Farm</dt>
          <dd>{penEntity.farm ? penEntity.farm.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/pen" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/pen/${penEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default PenDetail;
