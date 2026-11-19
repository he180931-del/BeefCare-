import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import {} from 'react-jhipster';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './farm.reducer';

export const FarmDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const farmEntity = useAppSelector(state => state.farm.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="farmDetailsHeading">Farm</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{farmEntity.id}</dd>
          <dt>
            <span id="name">Name</span>
          </dt>
          <dd>{farmEntity.name}</dd>
          <dt>
            <span id="location">Location</span>
          </dt>
          <dd>{farmEntity.location}</dd>
          <dt>
            <span id="contact">Contact</span>
          </dt>
          <dd>{farmEntity.contact}</dd>
          <dt>
            <span id="serviceStatus">Service Status</span>
          </dt>
          <dd>{farmEntity.serviceStatus}</dd>
        </dl>
        <Button as={Link as any} to="/farm" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/farm/${farmEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default FarmDetail;
