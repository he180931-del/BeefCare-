import React, { useEffect } from 'react';
import { Button, Col, FormText, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getAppUsers } from 'app/entities/app-user/app-user.reducer';

import { createEntity, getEntity, reset, updateEntity } from './platform-staff-access.reducer';

export const PlatformStaffAccessUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const appUsers = useAppSelector(state => state.appUser.entities);
  const platformStaffAccessEntity = useAppSelector(state => state.platformStaffAccess.entity);
  const loading = useAppSelector(state => state.platformStaffAccess.loading);
  const updating = useAppSelector(state => state.platformStaffAccess.updating);
  const updateSuccess = useAppSelector(state => state.platformStaffAccess.updateSuccess);

  const handleClose = () => {
    navigate('/platform-staff-access');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getAppUsers({}));
  }, []);

  useEffect(() => {
    if (updateSuccess) {
      handleClose();
    }
  }, [updateSuccess]);

  const saveEntity = values => {
    if (values.id !== undefined && typeof values.id !== 'number') {
      values.id = Number(values.id);
    }

    const entity = {
      ...platformStaffAccessEntity,
      ...values,
      user: appUsers.find(it => it.id.toString() === values.user?.toString()),
    };

    if (isNew) {
      dispatch(createEntity(entity));
    } else {
      dispatch(updateEntity(entity));
    }
  };

  const defaultValues = () =>
    isNew
      ? {}
      : {
          ...platformStaffAccessEntity,
          user: platformStaffAccessEntity?.user?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.platformStaffAccess.home.createOrEditLabel" data-cy="PlatformStaffAccessCreateUpdateHeading">
            Thêm mới hoặc cập nhật Platform Staff Access
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && (
                <ValidatedField name="id" required readOnly id="platform-staff-access-id" label="ID" validate={{ required: true }} />
              )}
              <ValidatedField
                label="Role"
                id="platform-staff-access-role"
                name="role"
                data-cy="role"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="Status"
                id="platform-staff-access-status"
                name="status"
                data-cy="status"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField id="platform-staff-access-user" name="user" data-cy="user" label="User" type="select" required>
                <option value="" key="0" />
                {appUsers
                  ? appUsers.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <Button
                as={Link as any}
                id="cancel-save"
                data-cy="entityCreateCancelButton"
                to="/platform-staff-access"
                replace
                variant="info"
              >
                <FontAwesomeIcon icon="arrow-left" />
                &nbsp;
                <span className="d-none d-md-inline">Quay lại</span>
              </Button>
              &nbsp;
              <Button variant="primary" id="save-entity" data-cy="entityCreateSaveButton" type="submit" disabled={updating}>
                <FontAwesomeIcon icon="save" />
                &nbsp; Lưu
              </Button>
            </ValidatedForm>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default PlatformStaffAccessUpdate;
