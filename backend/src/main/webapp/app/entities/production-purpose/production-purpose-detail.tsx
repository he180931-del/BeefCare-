import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './production-purpose.reducer';

export const ProductionPurposeDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const productionPurposeEntity = useAppSelector(state => state.productionPurpose.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="productionPurposeDetailsHeading">Production Purpose</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{productionPurposeEntity.id}</dd>
          <dt>
            <span id="code">Code</span>
          </dt>
          <dd>{productionPurposeEntity.code}</dd>
          <dt>
            <span id="name">Name</span>
          </dt>
          <dd>{productionPurposeEntity.name}</dd>
          <dt>
            <span id="description">Description</span>
          </dt>
          <dd>{productionPurposeEntity.description}</dd>
          <dt>
            <span id="available">Available</span>
          </dt>
          <dd>{productionPurposeEntity.available ? 'true' : 'false'}</dd>
          <dt>Farm</dt>
          <dd>{productionPurposeEntity.farm ? productionPurposeEntity.farm.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/production-purpose" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/production-purpose/${productionPurposeEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default ProductionPurposeDetail;
