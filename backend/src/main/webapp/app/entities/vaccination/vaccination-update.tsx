import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getCattles } from 'app/entities/cattle/cattle.reducer';
import { getEntities as getVaccines } from 'app/entities/vaccine/vaccine.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './vaccination.reducer';

export const VaccinationUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const cattles = useAppSelector(state => state.cattle.entities);
  const vaccines = useAppSelector(state => state.vaccine.entities);
  const vaccinationEntity = useAppSelector(state => state.vaccination.entity);
  const loading = useAppSelector(state => state.vaccination.loading);
  const updating = useAppSelector(state => state.vaccination.updating);
  const updateSuccess = useAppSelector(state => state.vaccination.updateSuccess);

  const handleClose = () => {
    navigate('/vaccination');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getCattles({}));
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
    values.entryTime = convertDateTimeToServer(values.entryTime);

    const entity = {
      ...vaccinationEntity,
      ...values,
      cattle: cattles.find(it => it.id.toString() === values.cattle?.toString()),
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
      ? {
          entryTime: displayDefaultDateTime(),
        }
      : {
          ...vaccinationEntity,
          entryTime: convertDateTimeFromServer(vaccinationEntity.entryTime),
          cattle: vaccinationEntity?.cattle?.id,
          vaccine: vaccinationEntity?.vaccine?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.vaccination.home.createOrEditLabel" data-cy="VaccinationCreateUpdateHeading">
            Thêm mới hoặc cập nhật Vaccination
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="vaccination-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Vaccination Date"
                id="vaccination-vaccinationDate"
                name="vaccinationDate"
                data-cy="vaccinationDate"
                type="date"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Entry Time"
                id="vaccination-entryTime"
                name="entryTime"
                data-cy="entryTime"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Dose"
                id="vaccination-dose"
                name="dose"
                data-cy="dose"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <ValidatedField
                label="Batch No"
                id="vaccination-batchNo"
                name="batchNo"
                data-cy="batchNo"
                type="text"
                validate={{
                  maxLength: { value: 50, message: 'Trường này không được vượt quá 50 ký tự.' },
                }}
              />
              <ValidatedField
                label="Source"
                id="vaccination-source"
                name="source"
                data-cy="source"
                type="text"
                validate={{
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ON_FARM | HISTORICAL</Tooltip>}>
                <span id="sourceLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Vaccinator"
                id="vaccination-vaccinator"
                name="vaccinator"
                data-cy="vaccinator"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <ValidatedField id="vaccination-cattle" name="cattle" data-cy="cattle" label="Cattle" type="select" required>
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
              <ValidatedField id="vaccination-vaccine" name="vaccine" data-cy="vaccine" label="Vaccine" type="select" required>
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
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/vaccination" replace variant="info">
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

export default VaccinationUpdate;
