import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './farm-invitation.reducer';

export const FarmInvitationDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const farmInvitationEntity = useAppSelector(state => state.farmInvitation.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="farmInvitationDetailsHeading">Farm Invitation</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{farmInvitationEntity.id}</dd>
          <dt>
            <span id="invitedEmail">Invited Email</span>
          </dt>
          <dd>{farmInvitationEntity.invitedEmail}</dd>
          <dt>
            <span id="proposedRole">Proposed Role</span>
          </dt>
          <dd>{farmInvitationEntity.proposedRole}</dd>
          <dt>
            <span id="proposedPermissions">Proposed Permissions</span>
          </dt>
          <dd>{farmInvitationEntity.proposedPermissions}</dd>
          <dt>
            <span id="status">Status</span>
          </dt>
          <dd>{farmInvitationEntity.status}</dd>
          <dt>
            <span id="expiresAt">Expires At</span>
          </dt>
          <dd>
            {farmInvitationEntity.expiresAt ? (
              <TextFormat value={farmInvitationEntity.expiresAt} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>Farm</dt>
          <dd>{farmInvitationEntity.farm ? farmInvitationEntity.farm.id : ''}</dd>
        </dl>
        <Button as={Link as any} to="/farm-invitation" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/farm-invitation/${farmInvitationEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default FarmInvitationDetail;
