import React, { useEffect } from 'react';
import { Button, Col, FormText, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getFarms } from 'app/entities/farm/farm.reducer';

import { createEntity, getEntity, reset, updateEntity } from './production-purpose.reducer';

export const ProductionPurposeUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const farms = useAppSelector(state => state.farm.entities);
  const productionPurposeEntity = useAppSelector(state => state.productionPurpose.entity);
  const loading = useAppSelector(state => state.productionPurpose.loading);
  const updating = useAppSelector(state => state.productionPurpose.updating);
  const updateSuccess = useAppSelector(state => state.productionPurpose.updateSuccess);

  const handleClose = () => {
    navigate('/production-purpose');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getFarms({}));
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
      ...productionPurposeEntity,
      ...values,
      farm: farms.find(it => it.id.toString() === values.farm?.toString()),
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
          ...productionPurposeEntity,
          farm: productionPurposeEntity?.farm?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.productionPurpose.home.createOrEditLabel" data-cy="ProductionPurposeCreateUpdateHeading">
            Thêm mới hoặc cập nhật Production Purpose
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="production-purpose-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Code"
                id="production-purpose-code"
                name="code"
                data-cy="code"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 50, message: 'Trường này không được vượt quá 50 ký tự.' },
                }}
              />
              <ValidatedField
                label="Name"
                id="production-purpose-name"
                name="name"
                data-cy="name"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <ValidatedField
                label="Description"
                id="production-purpose-description"
                name="description"
                data-cy="description"
                type="textarea"
              />
              <ValidatedField
                label="Available"
                id="production-purpose-available"
                name="available"
                data-cy="available"
                check
                type="checkbox"
              />
              <ValidatedField id="production-purpose-farm" name="farm" data-cy="farm" label="Farm" type="select" required>
                <option value="" key="0" />
                {farms
                  ? farms.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/production-purpose" replace variant="info">
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

export default ProductionPurposeUpdate;
