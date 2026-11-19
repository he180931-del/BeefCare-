import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import {} from 'react-jhipster';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './farm-membership.reducer';

export const FarmMembershipDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const farmMembershipEntity = useAppSelector(state => state.farmMembership.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="farmMembershipDetailsHeading">Farm Membership</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{farmMembershipEntity.id}</dd>
          <dt>
            <span id="role">Role</span>
          </dt>
          <dd>{farmMembershipEntity.role}</dd>
          <dt>
            <span id="status">Status</span>
          </dt>
          <dd>{farmMembershipEntity.status}</dd>
          <dt>Farm</dt>
          <dd>{farmMembershipEntity.farm ? farmMembershipEntity.farm.id : ''}</dd>
          <dt>User</dt>
          <dd>{farmMembershipEntity.user ? farmMembershipEntity.user.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/farm-membership" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/farm-membership/${farmMembershipEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default FarmMembershipDetail;
