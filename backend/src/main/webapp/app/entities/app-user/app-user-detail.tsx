import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import {} from 'react-jhipster';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './app-user.reducer';

export const AppUserDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const appUserEntity = useAppSelector(state => state.appUser.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="appUserDetailsHeading">App User</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{appUserEntity.id}</dd>
          <dt>
            <span id="email">Email</span>
          </dt>
          <dd>{appUserEntity.email}</dd>
          <dt>
            <span id="fullName">Full Name</span>
          </dt>
          <dd>{appUserEntity.fullName}</dd>
          <dt>
            <span id="phone">Phone</span>
          </dt>
          <dd>{appUserEntity.phone}</dd>
          <dt>
            <span id="accountStatus">Account Status</span>
          </dt>
          <dd>{appUserEntity.accountStatus}</dd>
          <dt>
            <span id="googleSubject">Google Subject</span>
            <OverlayTrigger
              overlay={<Tooltip>ERD: NOT NULL; để trống được vì tài khoản chỉ dùng mật khẩu không có Google subject</Tooltip>}
            >
              <span id="googleSubject" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{appUserEntity.googleSubject}</dd>
          <dt>
            <span id="passwordHash">Password Hash</span>
            <OverlayTrigger overlay={<Tooltip>ERD: NOT NULL; để trống được vì tài khoản chỉ dùng Google không có mật khẩu</Tooltip>}>
              <span id="passwordHash" className="d-inline-block">
                ?
              </span>
            </OverlayTrigger>
          </dt>
          <dd>{appUserEntity.passwordHash}</dd>
        </dl>
        <Button as={Link as any} to="/app-user" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/app-user/${appUserEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default AppUserDetail;
