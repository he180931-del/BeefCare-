import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import {} from 'react-jhipster';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './manager-permission.reducer';

export const ManagerPermissionDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const managerPermissionEntity = useAppSelector(state => state.managerPermission.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="managerPermissionDetailsHeading">Manager Permission</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{managerPermissionEntity.id}</dd>
          <dt>
            <span id="permissionCode">Permission Code</span>
          </dt>
          <dd>{managerPermissionEntity.permissionCode}</dd>
          <dt>
            <span id="enabled">Enabled</span>
          </dt>
          <dd>{managerPermissionEntity.enabled ? 'true' : 'false'}</dd>
          <dt>Membership</dt>
          <dd>{managerPermissionEntity.membership ? managerPermissionEntity.membership.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/manager-permission" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/manager-permission/${managerPermissionEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default ManagerPermissionDetail;
