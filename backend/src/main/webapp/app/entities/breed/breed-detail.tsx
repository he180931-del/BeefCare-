import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './breed.reducer';

export const BreedDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const breedEntity = useAppSelector(state => state.breed.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="breedDetailsHeading">Breed</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{breedEntity.id}</dd>
          <dt>
            <span id="code">Code</span>
          </dt>
          <dd>{breedEntity.code}</dd>
          <dt>
            <span id="name">Name</span>
          </dt>
          <dd>{breedEntity.name}</dd>
          <dt>
            <span id="description">Description</span>
          </dt>
          <dd>{breedEntity.description}</dd>
          <dt>
            <span id="available">Available</span>
          </dt>
          <dd>{breedEntity.available ? 'true' : 'false'}</dd>
          <dt>Farm</dt>
          <dd>{breedEntity.farm ? breedEntity.farm.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/breed" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/breed/${breedEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default BreedDetail;
