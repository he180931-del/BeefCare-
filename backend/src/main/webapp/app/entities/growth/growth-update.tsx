import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isNumber } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getCattles } from 'app/entities/cattle/cattle.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './growth.reducer';

export const GrowthUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const cattles = useAppSelector(state => state.cattle.entities);
  const growthEntity = useAppSelector(state => state.growth.entity);
  const loading = useAppSelector(state => state.growth.loading);
  const updating = useAppSelector(state => state.growth.updating);
  const updateSuccess = useAppSelector(state => state.growth.updateSuccess);

  const handleClose = () => {
    navigate('/growth');
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
    values.entryTime = convertDateTimeToServer(values.entryTime);
    if (values.weightKg !== undefined && typeof values.weightKg !== 'number') {
      values.weightKg = Number(values.weightKg);
    }
    if (values.bcs !== undefined && typeof values.bcs !== 'number') {
      values.bcs = Number(values.bcs);
    }

    const entity = {
      ...growthEntity,
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
      ? {
          entryTime: displayDefaultDateTime(),
        }
      : {
          ...growthEntity,
          entryTime: convertDateTimeFromServer(growthEntity.entryTime),
          cattle: growthEntity?.cattle?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.growth.home.createOrEditLabel" data-cy="GrowthCreateUpdateHeading">
            Thêm mới hoặc cập nhật Growth
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="growth-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Check Date"
                id="growth-checkDate"
                name="checkDate"
                data-cy="checkDate"
                type="date"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Entry Time"
                id="growth-entryTime"
                name="entryTime"
                data-cy="entryTime"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Weight Kg"
                id="growth-weightKg"
                name="weightKg"
                data-cy="weightKg"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="Weight Type"
                id="growth-weightType"
                name="weightType"
                data-cy="weightType"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>MEASURED | ESTIMATED</Tooltip>}>
                <span id="weightTypeLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Bcs"
                id="growth-bcs"
                name="bcs"
                data-cy="bcs"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="Status"
                id="growth-status"
                name="status"
                data-cy="status"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>VALID | CORRECTED | EXCLUDED</Tooltip>}>
                <span id="statusLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Correction Reason"
                id="growth-correctionReason"
                name="correctionReason"
                data-cy="correctionReason"
                type="textarea"
              />
              <ValidatedField id="growth-cattle" name="cattle" data-cy="cattle" label="Cattle" type="select" required>
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
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/growth" replace variant="info">
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

export default GrowthUpdate;
