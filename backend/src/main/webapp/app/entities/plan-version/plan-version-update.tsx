import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isNumber } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './plan-version.reducer';

export const PlanVersionUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const planVersionEntity = useAppSelector(state => state.planVersion.entity);
  const loading = useAppSelector(state => state.planVersion.loading);
  const updating = useAppSelector(state => state.planVersion.updating);
  const updateSuccess = useAppSelector(state => state.planVersion.updateSuccess);

  const handleClose = () => {
    navigate('/plan-version');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }
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
    if (values.price1y !== undefined && typeof values.price1y !== 'number') {
      values.price1y = Number(values.price1y);
    }
    if (values.price2y !== undefined && typeof values.price2y !== 'number') {
      values.price2y = Number(values.price2y);
    }
    if (values.price3y !== undefined && typeof values.price3y !== 'number') {
      values.price3y = Number(values.price3y);
    }
    values.effectiveAt = convertDateTimeToServer(values.effectiveAt);

    const entity = {
      ...planVersionEntity,
      ...values,
    };

    if (isNew) {
      dispatch(createEntity(entity));
    } else {
      dispatch(updateEntity(entity));
    }
  };

  const defaultValues = () =>
    isNew
      ? {
          effectiveAt: displayDefaultDateTime(),
        }
      : {
          ...planVersionEntity,
          effectiveAt: convertDateTimeFromServer(planVersionEntity.effectiveAt),
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.planVersion.home.createOrEditLabel" data-cy="PlanVersionCreateUpdateHeading">
            Thêm mới hoặc cập nhật Plan Version
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="plan-version-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Price 1 Y"
                id="plan-version-price1y"
                name="price1y"
                data-cy="price1y"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: price_1y / 2y / 3y - tách thành 3 cột</Tooltip>}>
                <span id="price1yLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Price 2 Y"
                id="plan-version-price2y"
                name="price2y"
                data-cy="price2y"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="Price 3 Y"
                id="plan-version-price3y"
                name="price3y"
                data-cy="price3y"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="Terms"
                id="plan-version-terms"
                name="terms"
                data-cy="terms"
                type="text"
                validate={{
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <ValidatedField
                label="Effective At"
                id="plan-version-effectiveAt"
                name="effectiveAt"
                data-cy="effectiveAt"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/plan-version" replace variant="info">
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

export default PlanVersionUpdate;
