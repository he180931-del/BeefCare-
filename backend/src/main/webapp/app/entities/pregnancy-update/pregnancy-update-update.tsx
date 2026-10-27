import React, { useEffect } from 'react';
import { Button, Col, FormText, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getHealthCases } from 'app/entities/health-case/health-case.reducer';
import { getEntities as getPregnancyEpisodes } from 'app/entities/pregnancy-episode/pregnancy-episode.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './pregnancy-update.reducer';

export const PregnancyUpdateUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const pregnancyEpisodes = useAppSelector(state => state.pregnancyEpisode.entities);
  const healthCases = useAppSelector(state => state.healthCase.entities);
  const pregnancyUpdateEntity = useAppSelector(state => state.pregnancyUpdate.entity);
  const loading = useAppSelector(state => state.pregnancyUpdate.loading);
  const updating = useAppSelector(state => state.pregnancyUpdate.updating);
  const updateSuccess = useAppSelector(state => state.pregnancyUpdate.updateSuccess);

  const handleClose = () => {
    navigate('/pregnancy-update');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getPregnancyEpisodes({}));
    dispatch(getHealthCases({}));
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
    values.occurredTime = convertDateTimeToServer(values.occurredTime);

    const entity = {
      ...pregnancyUpdateEntity,
      ...values,
      episode: pregnancyEpisodes.find(it => it.id.toString() === values.episode?.toString()),
      healthCase: healthCases.find(it => it.id.toString() === values.healthCase?.toString()),
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
          occurredTime: displayDefaultDateTime(),
        }
      : {
          ...pregnancyUpdateEntity,
          occurredTime: convertDateTimeFromServer(pregnancyUpdateEntity.occurredTime),
          episode: pregnancyUpdateEntity?.episode?.id,
          healthCase: pregnancyUpdateEntity?.healthCase?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.pregnancyUpdate.home.createOrEditLabel" data-cy="PregnancyUpdateCreateUpdateHeading">
            Thêm mới hoặc cập nhật Pregnancy Update
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="pregnancy-update-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Type"
                id="pregnancy-update-type"
                name="type"
                data-cy="type"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="Occurred Time"
                id="pregnancy-update-occurredTime"
                name="occurredTime"
                data-cy="occurredTime"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField label="Details" id="pregnancy-update-details" name="details" data-cy="details" type="textarea" />
              <ValidatedField id="pregnancy-update-episode" name="episode" data-cy="episode" label="Episode" type="select" required>
                <option value="" key="0" />
                {pregnancyEpisodes
                  ? pregnancyEpisodes.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField id="pregnancy-update-healthCase" name="healthCase" data-cy="healthCase" label="Health Case" type="select">
                <option value="" key="0" />
                {healthCases
                  ? healthCases.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/pregnancy-update" replace variant="info">
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

export default PregnancyUpdateUpdate;
