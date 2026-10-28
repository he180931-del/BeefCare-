import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import {} from 'react-jhipster';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './platform-staff-access.reducer';

export const PlatformStaffAccessDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const platformStaffAccessEntity = useAppSelector(state => state.platformStaffAccess.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="platformStaffAccessDetailsHeading">Platform Staff Access</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{platformStaffAccessEntity.id}</dd>
          <dt>
            <span id="role">Role</span>
          </dt>
          <dd>{platformStaffAccessEntity.role}</dd>
          <dt>
            <span id="status">Status</span>
          </dt>
          <dd>{platformStaffAccessEntity.status}</dd>
          <dt>User</dt>
          <dd>{platformStaffAccessEntity.user ? platformStaffAccessEntity.user.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/platform-staff-access" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/platform-staff-access/${platformStaffAccessEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default PlatformStaffAccessDetail;
