import React, { useEffect } from 'react';
import { Button, Col, FormText, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getFarmMemberships } from 'app/entities/farm-membership/farm-membership.reducer';

import { createEntity, getEntity, reset, updateEntity } from './manager-permission.reducer';

export const ManagerPermissionUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const farmMemberships = useAppSelector(state => state.farmMembership.entities);
  const managerPermissionEntity = useAppSelector(state => state.managerPermission.entity);
  const loading = useAppSelector(state => state.managerPermission.loading);
  const updating = useAppSelector(state => state.managerPermission.updating);
  const updateSuccess = useAppSelector(state => state.managerPermission.updateSuccess);

  const handleClose = () => {
    navigate('/manager-permission');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getFarmMemberships({}));
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
      ...managerPermissionEntity,
      ...values,
      membership: farmMemberships.find(it => it.id.toString() === values.membership?.toString()),
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
          ...managerPermissionEntity,
          membership: managerPermissionEntity?.membership?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.managerPermission.home.createOrEditLabel" data-cy="ManagerPermissionCreateUpdateHeading">
            Thêm mới hoặc cập nhật Manager Permission
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="manager-permission-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Permission Code"
                id="manager-permission-permissionCode"
                name="permissionCode"
                data-cy="permissionCode"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 50, message: 'Trường này không được vượt quá 50 ký tự.' },
                }}
              />
              <ValidatedField label="Enabled" id="manager-permission-enabled" name="enabled" data-cy="enabled" check type="checkbox" />
              <ValidatedField
                id="manager-permission-membership"
                name="membership"
                data-cy="membership"
                label="Membership"
                type="select"
                required
              >
                <option value="" key="0" />
                {farmMemberships
                  ? farmMemberships.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/manager-permission" replace variant="info">
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

export default ManagerPermissionUpdate;
