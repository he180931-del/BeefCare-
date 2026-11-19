import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getCattles } from 'app/entities/cattle/cattle.reducer';

import { createEntity, getEntity, reset, updateEntity } from './cattle-profile-change.reducer';

export const CattleProfileChangeUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const cattles = useAppSelector(state => state.cattle.entities);
  const cattleProfileChangeEntity = useAppSelector(state => state.cattleProfileChange.entity);
  const loading = useAppSelector(state => state.cattleProfileChange.loading);
  const updating = useAppSelector(state => state.cattleProfileChange.updating);
  const updateSuccess = useAppSelector(state => state.cattleProfileChange.updateSuccess);

  const handleClose = () => {
    navigate('/cattle-profile-change');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getCattles({}));
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
      ...cattleProfileChangeEntity,
      ...values,
      cattle: cattles.find(it => it.id.toString() === values.cattle?.toString()),
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
          ...cattleProfileChangeEntity,
          cattle: cattleProfileChangeEntity?.cattle?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.cattleProfileChange.home.createOrEditLabel" data-cy="CattleProfileChangeCreateUpdateHeading">
            Thêm mới hoặc cập nhật Cattle Profile Change
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
                <ValidatedField name="id" required readOnly id="cattle-profile-change-id" label="ID" validate={{ required: true }} />
              )}
              <ValidatedField
                label="Field Name"
                id="cattle-profile-change-fieldName"
                name="fieldName"
                data-cy="fieldName"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: field</Tooltip>}>
                <span id="fieldNameLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Old Value"
                id="cattle-profile-change-oldValue"
                name="oldValue"
                data-cy="oldValue"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <ValidatedField
                label="New Value"
                id="cattle-profile-change-newValue"
                name="newValue"
                data-cy="newValue"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <ValidatedField
                label="Effective Date"
                id="cattle-profile-change-effectiveDate"
                name="effectiveDate"
                data-cy="effectiveDate"
                type="date"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField label="Reason" id="cattle-profile-change-reason" name="reason" data-cy="reason" type="textarea" />
              <ValidatedField id="cattle-profile-change-cattle" name="cattle" data-cy="cattle" label="Cattle" type="select" required>
                <option value="" key="0" />
                {cattles
                  ? cattles.map(otherEntity => (
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
                to="/cattle-profile-change"
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

export default CattleProfileChangeUpdate;
