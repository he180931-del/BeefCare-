import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isNumber } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getCattles } from 'app/entities/cattle/cattle.reducer';
import { getEntities as getVaccinations } from 'app/entities/vaccination/vaccination.reducer';
import { getEntities as getVaccinationSchedules } from 'app/entities/vaccination-schedule/vaccination-schedule.reducer';

import { createEntity, getEntity, reset, updateEntity } from './scheduled-dose.reducer';

export const ScheduledDoseUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const vaccinations = useAppSelector(state => state.vaccination.entities);
  const vaccinationSchedules = useAppSelector(state => state.vaccinationSchedule.entities);
  const cattles = useAppSelector(state => state.cattle.entities);
  const scheduledDoseEntity = useAppSelector(state => state.scheduledDose.entity);
  const loading = useAppSelector(state => state.scheduledDose.loading);
  const updating = useAppSelector(state => state.scheduledDose.updating);
  const updateSuccess = useAppSelector(state => state.scheduledDose.updateSuccess);

  const handleClose = () => {
    navigate('/scheduled-dose');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getVaccinations({}));
    dispatch(getVaccinationSchedules({}));
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
    if (values.doseNo !== undefined && typeof values.doseNo !== 'number') {
      values.doseNo = Number(values.doseNo);
    }

    const entity = {
      ...scheduledDoseEntity,
      ...values,
      vaccination: vaccinations.find(it => it.id.toString() === values.vaccination?.toString()),
      schedule: vaccinationSchedules.find(it => it.id.toString() === values.schedule?.toString()),
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
          ...scheduledDoseEntity,
          vaccination: scheduledDoseEntity?.vaccination?.id,
          schedule: scheduledDoseEntity?.schedule?.id,
          cattle: scheduledDoseEntity?.cattle?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.scheduledDose.home.createOrEditLabel" data-cy="ScheduledDoseCreateUpdateHeading">
            Thêm mới hoặc cập nhật Scheduled Dose
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="scheduled-dose-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Dose No"
                id="scheduled-dose-doseNo"
                name="doseNo"
                data-cy="doseNo"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="Due Date"
                id="scheduled-dose-dueDate"
                name="dueDate"
                data-cy="dueDate"
                type="date"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Status"
                id="scheduled-dose-status"
                name="status"
                data-cy="status"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>PLANNED | DONE | DEFERRED | CANCELLED</Tooltip>}>
                <span id="statusLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Deferral Reason"
                id="scheduled-dose-deferralReason"
                name="deferralReason"
                data-cy="deferralReason"
                type="textarea"
              />
              <ValidatedField
                label="New Expected Date"
                id="scheduled-dose-newExpectedDate"
                name="newExpectedDate"
                data-cy="newExpectedDate"
                type="date"
              />
              <ValidatedField id="scheduled-dose-vaccination" name="vaccination" data-cy="vaccination" label="Vaccination" type="select">
                <option value="" key="0" />
                {vaccinations
                  ? vaccinations.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <ValidatedField id="scheduled-dose-schedule" name="schedule" data-cy="schedule" label="Schedule" type="select" required>
                <option value="" key="0" />
                {vaccinationSchedules
                  ? vaccinationSchedules.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField id="scheduled-dose-cattle" name="cattle" data-cy="cattle" label="Cattle" type="select" required>
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
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/scheduled-dose" replace variant="info">
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

export default ScheduledDoseUpdate;
