import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getHealthCases } from 'app/entities/health-case/health-case.reducer';
import { getEntities as getMedicines } from 'app/entities/medicine/medicine.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './treatment.reducer';

export const TreatmentUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const healthCases = useAppSelector(state => state.healthCase.entities);
  const medicines = useAppSelector(state => state.medicine.entities);
  const treatmentEntity = useAppSelector(state => state.treatment.entity);
  const loading = useAppSelector(state => state.treatment.loading);
  const updating = useAppSelector(state => state.treatment.updating);
  const updateSuccess = useAppSelector(state => state.treatment.updateSuccess);

  const handleClose = () => {
    navigate('/treatment');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getHealthCases({}));
    dispatch(getMedicines({}));
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
    values.treatmentTime = convertDateTimeToServer(values.treatmentTime);
    values.entryTime = convertDateTimeToServer(values.entryTime);

    const entity = {
      ...treatmentEntity,
      ...values,
      healthCase: healthCases.find(it => it.id.toString() === values.healthCase?.toString()),
      medicine: medicines.find(it => it.id.toString() === values.medicine?.toString()),
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
          treatmentTime: displayDefaultDateTime(),
          entryTime: displayDefaultDateTime(),
        }
      : {
          ...treatmentEntity,
          treatmentTime: convertDateTimeFromServer(treatmentEntity.treatmentTime),
          entryTime: convertDateTimeFromServer(treatmentEntity.entryTime),
          healthCase: treatmentEntity?.healthCase?.id,
          medicine: treatmentEntity?.medicine?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.treatment.home.createOrEditLabel" data-cy="TreatmentCreateUpdateHeading">
            Thêm mới hoặc cập nhật Treatment
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="treatment-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Treatment Time"
                id="treatment-treatmentTime"
                name="treatmentTime"
                data-cy="treatmentTime"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Entry Time"
                id="treatment-entryTime"
                name="entryTime"
                data-cy="entryTime"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Treatment Detail"
                id="treatment-treatmentDetail"
                name="treatmentDetail"
                data-cy="treatmentDetail"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <ValidatedField
                label="Dose"
                id="treatment-dose"
                name="dose"
                data-cy="dose"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: dose / route - tách 2 cột</Tooltip>}>
                <span id="doseLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Route"
                id="treatment-route"
                name="route"
                data-cy="route"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <ValidatedField
                label="Withdrawal Period"
                id="treatment-withdrawalPeriod"
                name="withdrawalPeriod"
                data-cy="withdrawalPeriod"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <ValidatedField
                label="Result"
                id="treatment-result"
                name="result"
                data-cy="result"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField id="treatment-healthCase" name="healthCase" data-cy="healthCase" label="Health Case" type="select" required>
                <option value="" key="0" />
                {healthCases
                  ? healthCases.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField id="treatment-medicine" name="medicine" data-cy="medicine" label="Medicine" type="select">
                <option value="" key="0" />
                {medicines
                  ? medicines.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/treatment" replace variant="info">
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

export default TreatmentUpdate;
