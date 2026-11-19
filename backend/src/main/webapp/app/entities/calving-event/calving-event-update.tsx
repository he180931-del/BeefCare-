import React, { useEffect } from 'react';
import { Button, Col, FormText, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getCattles } from 'app/entities/cattle/cattle.reducer';
import { getEntities as getPregnancyEpisodes } from 'app/entities/pregnancy-episode/pregnancy-episode.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './calving-event.reducer';

export const CalvingEventUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const cattles = useAppSelector(state => state.cattle.entities);
  const pregnancyEpisodes = useAppSelector(state => state.pregnancyEpisode.entities);
  const calvingEventEntity = useAppSelector(state => state.calvingEvent.entity);
  const loading = useAppSelector(state => state.calvingEvent.loading);
  const updating = useAppSelector(state => state.calvingEvent.updating);
  const updateSuccess = useAppSelector(state => state.calvingEvent.updateSuccess);

  const handleClose = () => {
    navigate('/calving-event');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getCattles({}));
    dispatch(getPregnancyEpisodes({}));
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
    values.birthTime = convertDateTimeToServer(values.birthTime);

    const entity = {
      ...calvingEventEntity,
      ...values,
      dam: cattles.find(it => it.id.toString() === values.dam?.toString()),
      episode: pregnancyEpisodes.find(it => it.id.toString() === values.episode?.toString()),
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
          birthTime: displayDefaultDateTime(),
        }
      : {
          ...calvingEventEntity,
          birthTime: convertDateTimeFromServer(calvingEventEntity.birthTime),
          dam: calvingEventEntity?.dam?.id,
          episode: calvingEventEntity?.episode?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.calvingEvent.home.createOrEditLabel" data-cy="CalvingEventCreateUpdateHeading">
            Thêm mới hoặc cập nhật Calving Event
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="calving-event-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Birth Time"
                id="calving-event-birthTime"
                name="birthTime"
                data-cy="birthTime"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Course"
                id="calving-event-course"
                name="course"
                data-cy="course"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="Dam Condition"
                id="calving-event-damCondition"
                name="damCondition"
                data-cy="damCondition"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField id="calving-event-dam" name="dam" data-cy="dam" label="Dam" type="select" required>
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
              <ValidatedField id="calving-event-episode" name="episode" data-cy="episode" label="Episode" type="select">
                <option value="" key="0" />
                {pregnancyEpisodes
                  ? pregnancyEpisodes.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/calving-event" replace variant="info">
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

export default CalvingEventUpdate;
