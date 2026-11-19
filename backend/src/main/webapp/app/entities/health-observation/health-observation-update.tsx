import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getHealthCases } from 'app/entities/health-case/health-case.reducer';
import { getEntities as getVaccinations } from 'app/entities/vaccination/vaccination.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './health-observation.reducer';

export const HealthObservationUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const healthCases = useAppSelector(state => state.healthCase.entities);
  const vaccinations = useAppSelector(state => state.vaccination.entities);
  const healthObservationEntity = useAppSelector(state => state.healthObservation.entity);
  const loading = useAppSelector(state => state.healthObservation.loading);
  const updating = useAppSelector(state => state.healthObservation.updating);
  const updateSuccess = useAppSelector(state => state.healthObservation.updateSuccess);

  const handleClose = () => {
    navigate('/health-observation');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getHealthCases({}));
    dispatch(getVaccinations({}));
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
    values.observedTime = convertDateTimeToServer(values.observedTime);
    values.entryTime = convertDateTimeToServer(values.entryTime);

    const entity = {
      ...healthObservationEntity,
      ...values,
      healthCase: healthCases.find(it => it.id.toString() === values.healthCase?.toString()),
      vaccination: vaccinations.find(it => it.id.toString() === values.vaccination?.toString()),
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
          observedTime: displayDefaultDateTime(),
          entryTime: displayDefaultDateTime(),
        }
      : {
          ...healthObservationEntity,
          observedTime: convertDateTimeFromServer(healthObservationEntity.observedTime),
          entryTime: convertDateTimeFromServer(healthObservationEntity.entryTime),
          healthCase: healthObservationEntity?.healthCase?.id,
          vaccination: healthObservationEntity?.vaccination?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.healthObservation.home.createOrEditLabel" data-cy="HealthObservationCreateUpdateHeading">
            Thêm mới hoặc cập nhật Health Observation
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="health-observation-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Observed Time"
                id="health-observation-observedTime"
                name="observedTime"
                data-cy="observedTime"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Entry Time"
                id="health-observation-entryTime"
                name="entryTime"
                data-cy="entryTime"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Signs Progress"
                id="health-observation-signsProgress"
                name="signsProgress"
                data-cy="signsProgress"
                type="textarea"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: signs / progress</Tooltip>}>
                <span id="signsProgressLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Source"
                id="health-observation-source"
                name="source"
                data-cy="source"
                type="text"
                validate={{
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                id="health-observation-healthCase"
                name="healthCase"
                data-cy="healthCase"
                label="Health Case"
                type="select"
                required
              >
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
              <ValidatedField
                id="health-observation-vaccination"
                name="vaccination"
                data-cy="vaccination"
                label="Vaccination"
                type="select"
              >
                <option value="" key="0" />
                {vaccinations
                  ? vaccinations.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/health-observation" replace variant="info">
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

export default HealthObservationUpdate;
