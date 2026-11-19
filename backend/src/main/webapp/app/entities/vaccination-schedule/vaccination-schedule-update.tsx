import React, { useEffect } from 'react';
import { Button, Col, FormText, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isNumber } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getFarms } from 'app/entities/farm/farm.reducer';
import { getEntities as getVaccines } from 'app/entities/vaccine/vaccine.reducer';

import { createEntity, getEntity, reset, updateEntity } from './vaccination-schedule.reducer';

export const VaccinationScheduleUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const farms = useAppSelector(state => state.farm.entities);
  const vaccines = useAppSelector(state => state.vaccine.entities);
  const vaccinationScheduleEntity = useAppSelector(state => state.vaccinationSchedule.entity);
  const loading = useAppSelector(state => state.vaccinationSchedule.loading);
  const updating = useAppSelector(state => state.vaccinationSchedule.updating);
  const updateSuccess = useAppSelector(state => state.vaccinationSchedule.updateSuccess);

  const handleClose = () => {
    navigate('/vaccination-schedule');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getFarms({}));
    dispatch(getVaccines({}));
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
    if (values.doseCount !== undefined && typeof values.doseCount !== 'number') {
      values.doseCount = Number(values.doseCount);
    }
    if (values.intervalDays !== undefined && typeof values.intervalDays !== 'number') {
      values.intervalDays = Number(values.intervalDays);
    }

    const entity = {
      ...vaccinationScheduleEntity,
      ...values,
      farm: farms.find(it => it.id.toString() === values.farm?.toString()),
      vaccine: vaccines.find(it => it.id.toString() === values.vaccine?.toString()),
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
          ...vaccinationScheduleEntity,
          farm: vaccinationScheduleEntity?.farm?.id,
          vaccine: vaccinationScheduleEntity?.vaccine?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.vaccinationSchedule.home.createOrEditLabel" data-cy="VaccinationScheduleCreateUpdateHeading">
            Thêm mới hoặc cập nhật Vaccination Schedule
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
                <ValidatedField name="id" required readOnly id="vaccination-schedule-id" label="ID" validate={{ required: true }} />
              )}
              <ValidatedField
                label="Target Group"
                id="vaccination-schedule-targetGroup"
                name="targetGroup"
                data-cy="targetGroup"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <ValidatedField
                label="First Due Date"
                id="vaccination-schedule-firstDueDate"
                name="firstDueDate"
                data-cy="firstDueDate"
                type="date"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Dose Count"
                id="vaccination-schedule-doseCount"
                name="doseCount"
                data-cy="doseCount"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="Interval Days"
                id="vaccination-schedule-intervalDays"
                name="intervalDays"
                data-cy="intervalDays"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="Status"
                id="vaccination-schedule-status"
                name="status"
                data-cy="status"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField id="vaccination-schedule-farm" name="farm" data-cy="farm" label="Farm" type="select" required>
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
              <ValidatedField id="vaccination-schedule-vaccine" name="vaccine" data-cy="vaccine" label="Vaccine" type="select" required>
                <option value="" key="0" />
                {vaccines
                  ? vaccines.map(otherEntity => (
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
                to="/vaccination-schedule"
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

export default VaccinationScheduleUpdate;
